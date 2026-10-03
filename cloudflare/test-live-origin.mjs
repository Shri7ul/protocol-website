/**
 * Live check against the REAL Vercel origin.
 *
 * Unlike the other suites, this touches the network: it drives the Worker
 * against the configured production origin so the `KEEPS_PREFIX` decision is
 * validated against reality rather than a stub.
 *
 *   node cloudflare/test-live-origin.mjs
 *
 * Read-only: only GET requests, no writes, no credentials.
 */

const ORIGIN = "https://website-protocol-ten.vercel.app";
const PREFIX = "/protocol";

/** Pages that must exist, as app-relative routes. */
const PAGES = ["", "/tcp", "/udp", "/http", "/https", "/i2c", "/can"];

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass: Boolean(pass), detail });

async function status(url, method = "GET") {
  try {
    const res = await fetch(url, { method, redirect: "manual" });
    return res.status;
  } catch (error) {
    return `ERR ${error.message}`;
  }
}

// 1 — The origin must serve the app under the prefix.
for (const page of PAGES) {
  const url = `${ORIGIN}${PREFIX}${page}`;
  const code = await status(url);
  check(
    `origin ${PREFIX}${page || "/"} -> 200`,
    code === 200,
    `got ${code}`,
  );
}

// 2 — The origin must NOT serve the stripped path. This is what makes
//     PROTOCOL_ORIGIN_KEEPS_PREFIX=true mandatory rather than optional.
for (const page of ["", "/tcp", "/can"]) {
  const url = `${ORIGIN}${page || "/"}`;
  const code = await status(url);
  check(
    `origin ${page || "/"} (stripped) -> NOT 200`,
    code !== 200,
    `got ${code} — if this is 200 the flag should be false`,
  );
}

// 3 — A real asset must be reachable, proving the prefixed asset namespace.
const html = await fetch(`${ORIGIN}${PREFIX}`).then((r) => r.text());
const assetMatch = html.match(
  /(?:src|href)="(\/protocol\/_next\/[^"]+)"/,
);
check(
  "origin HTML references /protocol/_next/... assets",
  Boolean(assetMatch),
  assetMatch ? "" : "no prefixed asset reference found",
);

if (assetMatch) {
  const code = await status(`${ORIGIN}${assetMatch[1]}`);
  check(
    `real asset loads (${assetMatch[1].slice(0, 46)}…)`,
    code === 200,
    `got ${code}`,
  );
}

// 4 — The app's identity, so we are certain this is Protocol Atlas.
check(
  "origin serves Protocol Atlas",
  /Protocol Atlas/i.test(html) && /data actually moves/i.test(html),
  `title=${(html.match(/<title>([^<]*)/) || [])[1] ?? "?"}`,
);

console.log("\n=== Live origin check ===\n");
console.log(`origin: ${ORIGIN}\n`);
let passed = 0;
for (const t of results) {
  console.log(`${t.pass ? "PASS" : "FAIL"}   ${t.name}${t.pass ? "" : `\n       -> ${t.detail}`}`);
  if (t.pass) passed++;
}
console.log(`\n${passed}/${results.length} live assertions passed\n`);
process.exit(passed === results.length ? 0 : 1);
