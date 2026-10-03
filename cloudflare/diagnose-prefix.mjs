/**
 * Diagnoses WHERE a path prefix is being added on the public route.
 *
 * The question this answers: when `https://shriful.tech/protocol` serves HTML
 * containing `href="/protocol/tcp"`, is that because
 *
 *   (a) the Next.js build has `basePath: "/protocol"` — so the app generates
 *       them, and the RSC payload will contain a `"p":"/protocol"` field, or
 *   (b) something in the request path is REWRITING the HTML on the way out —
 *       so the origin's own HTML has `href="/tcp"` and the public copy differs.
 *
 * The two have completely different fixes, so guessing is expensive. This
 * fetches BOTH addresses and diffs them.
 *
 *   node cloudflare/diagnose-prefix.mjs
 *   node cloudflare/diagnose-prefix.mjs https://origin.example https://public.example/base
 *
 * Read-only: GET only.
 */

const ORIGIN = process.argv[2] ?? "https://website-protocol-ten.vercel.app";
const PUBLIC = process.argv[3] ?? "https://shriful.tech/protocol";

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass: Boolean(pass), detail });

/** Fetch and collect everything we need to characterise one address. */
async function probe(base) {
  const res = await fetch(base, { redirect: "manual" });
  const html = await res.text();

  /** Root-absolute hrefs/srcs, deduped. */
  const hrefs = [...new Set((html.match(/(?:href|src)="(\/[^"]*)"/g) ?? [])
    .map((m) => m.replace(/^(?:href|src)="/, "").replace(/"$/, "")))].sort();

  /** Asset refs, which is where a real basePath is unmistakable. */
  const assetRefs = hrefs.filter((h) => h.includes("_next/"));

  /** A real `basePath` build serialises the router's prefix into the payload. */
  const basePathField = (html.match(/"p":"([^"]*)"/) ?? [])[1] ?? null;

  return {
    base,
    status: res.status,
    bytes: Buffer.byteLength(html, "utf8"),
    hrefs,
    assetRefs,
    basePathField,
    html,
  };
}

const origin = await probe(ORIGIN);
const publicSide = await probe(PUBLIC);

check(`${ORIGIN} reachable`, origin.status === 200, `status ${origin.status}`);
check(`${PUBLIC} reachable`, publicSide.status === 200, `status ${publicSide.status}`);

// --- 1. Does the ORIGIN serve prefix-free HTML? ---------------------------
//
// This is the build-shape question, and it is answerable without guessing:
// asset URLs are emitted by the framework, so a prefixed asset on the origin
// means `basePath` is set in the build.
const originPrefixedAssets = origin.assetRefs.filter((h) => h.startsWith("/protocol/"));
check(
  `origin HTML has NO prefixed assets (basePath unset)`,
  originPrefixedAssets.length === 0,
  `found ${originPrefixedAssets.length}: ${originPrefixedAssets.slice(0, 3).join(", ")}`,
);

check(
  `origin does not serialise a basePath field`,
  origin.basePathField === null || origin.basePathField === "",
  `"p":${JSON.stringify(origin.basePathField)}`,
);

// --- 2. Does the PUBLIC address differ? -----------------------------------
//
// Byte inequality here, given the same requested route, is the rewrite
// signature: the origin served one document and the browser received another.
const identical = origin.bytes === publicSide.bytes;
check(
  "public HTML is byte-identical to origin HTML",
  identical,
  `origin=${origin.bytes}B public=${publicSide.bytes}B (delta ${publicSide.bytes - origin.bytes}B) ` +
    `— a differing body means something is rewriting the response`,
);

const publicPrefixedAssets = publicSide.assetRefs.filter((h) => h.startsWith("/protocol/"));
check(
  "public HTML has no injected prefixed assets",
  publicPrefixedAssets.length === 0,
  `found ${publicPrefixedAssets.length}: ${publicPrefixedAssets.slice(0, 3).join(", ")}`,
);

// --- 3. Classify the prefix source ----------------------------------------
//
// Three mutually exclusive outcomes, so the reader is told which fix applies.
let diagnosis;
if (!identical && originPrefixedAssets.length === 0) {
  diagnosis = "HTML IS BEING REWRITTEN IN TRANSIT";
} else if (identical && originPrefixedAssets.length > 0) {
  diagnosis = "THE BUILD HAS basePath SET";
} else if (identical && originPrefixedAssets.length === 0 && publicPrefixedAssets.length === 0) {
  diagnosis = "NO PREFIX ANYWHERE — the proxy is not adding one";
} else {
  diagnosis = "MIXED / UNEXPECTED";
}

// --- 4. Direct-reload support --------------------------------------------
//
// Whatever the diagnosis, a deep link through the public address must work.
// This is the requirement the rewrite-based approach silently fails: the HTML
// claims `/protocol/tcp`, so the browser asks for that, and the upstream must
// be able to answer it.
const deep = await fetch(`${PUBLIC}/tcp`, { redirect: "manual" });
check(
  `${PUBLIC}/tcp (direct reload) -> 200`,
  deep.status === 200,
  `status ${deep.status}`,
);

const deepHtml = deep.status === 200 ? await deep.text() : "";
check(
  "  deep-link HTML is the app",
  /Protocol Atlas/i.test(deepHtml),
  `title=${(deepHtml.match(/<title>([^<]*)/) ?? [])[1] ?? "?"}`,
);

// The RSC request a client-side navigation issues must also survive.
const rsc = await fetch(`${PUBLIC}/tcp?_rsc=probe`, {
  headers: { RSC: "1" },
  redirect: "manual",
});
check(
  `${PUBLIC}/tcp?_rsc=... (router fetch) -> 200`,
  rsc.status === 200,
  `status ${rsc.status}`,
);

console.log("\n=== Path-prefix diagnosis ===\n");
console.log(`origin : ${origin.base}   (${origin.bytes} B)`);
console.log(`public : ${publicSide.base}   (${publicSide.bytes} B)`);
console.log(`\nDIAGNOSIS: ${diagnosis}\n`);

if (origin.hrefs.length && publicSide.hrefs.length) {
  const onlyPublic = publicSide.hrefs.filter((h) => !origin.hrefs.includes(h));
  if (onlyPublic.length) {
    console.log("hrefs present in public but NOT in origin (injected):");
    for (const h of onlyPublic.slice(0, 8)) console.log(`  ${h}`);
    console.log();
  }
}

let passed = 0;
for (const t of results) {
  console.log(`${t.pass ? "PASS" : "FAIL"}   ${t.name}${t.pass ? "" : `\n       -> ${t.detail}`}`);
  if (t.pass) passed++;
}
console.log(`\n${passed}/${results.length} diagnosis assertions passed\n`);
process.exit(passed === results.length ? 0 : 1);
