/**
 * Live check against the REAL deployment.
 *
 * Unlike the other suites, this touches the network: it fetches the configured
 * origin directly so the origin-shape decision is validated against reality
 * rather than a stub.
 *
 *   node cloudflare/test-live-origin.mjs
 *
 * ─── What shape it expects ──────────────────────────────────────────────────
 *
 * The app is built at its OWN ROOT (`basePath` unset), so the deployment must
 * serve the app at `/` and 404 the prefix:
 *
 *   /                 -> 200   app root
 *   /tcp              -> 200
 *   /_next/...        -> 200
 *   /protocol         -> 404   the prefix belongs to the proxy, not the origin
 *
 * That is what makes `PROTOCOL_ORIGIN_KEEPS_PREFIX=false` correct: the Worker
 * strips `/protocol` and forwards to these root paths.
 *
 * ─── If this suite fails after a config change ──────────────────────────────
 *
 * Almost always one of two things:
 *
 *   1. The deployment was built with `NEXT_PUBLIC_BASE_PATH=/protocol`, so it
 *      still serves under the prefix. Either rebuild without that variable, or
 *      set `PROTOCOL_ORIGIN_KEEPS_PREFIX: "true"` in `wrangler.jsonc` to match.
 *      `npm run test:config` asserts the pairing.
 *   2. The deployment simply has not been redeployed since the build change.
 *      This suite reads the LIVE host, so it cannot pass until Vercel has the
 *      new build.
 *
 * Read-only: only GET requests, no writes, no credentials.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Read the origin and flag from wrangler.jsonc so this cannot drift from config. */
function readConfig() {
  const raw = readFileSync(join(here, "wrangler.jsonc"), "utf8");
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const cfg = JSON.parse(stripped);
  return cfg.vars ?? {};
}

const vars = readConfig();
const ORIGIN = (vars.PROTOCOL_ORIGIN ?? "").replace(/\/+$/, "");
const PREFIX = vars.PROTOCOL_PREFIX ?? "/protocol";
const keepsRaw = String(vars.PROTOCOL_ORIGIN_KEEPS_PREFIX ?? "").toLowerCase();
const KEEPS_PREFIX = keepsRaw === "true" || keepsRaw === "1" || keepsRaw === "yes";

/** The path shape this origin should serve, derived from the flag. */
const originFor = (appPath) =>
  KEEPS_PREFIX ? `${PREFIX}${appPath === "/" ? "" : appPath}` : appPath;

/** Pages that must exist, as app-relative routes. */
const PAGES = ["/", "/tcp", "/udp", "/http", "/https", "/i2c", "/can"];

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass: Boolean(pass), detail });

async function get(url) {
  try {
    return await fetch(url, { redirect: "manual" });
  } catch (error) {
    return { status: `ERR ${error.message}`, headers: new Headers(), text: async () => "" };
  }
}

async function status(url) {
  const res = await get(url);
  return res.status;
}

// 1 — The origin must serve every page in the shape the flag selects.
for (const page of PAGES) {
  const url = `${ORIGIN}${originFor(page)}`;
  const code = await status(url);
  check(`${ORIGIN}${originFor(page)} -> 200`, code === 200, `got ${code}`);
}

// 2 — The OTHER shape must NOT be 200. This is the assertion that makes the
//     flag load-bearing: if both shapes answered 200 the flag would be
//     untestable, and if the wrong one answers the deployment is misconfigured.
for (const page of ["/", "/tcp"]) {
  const other = KEEPS_PREFIX ? page : `${PREFIX}${page === "/" ? "" : page}`;
  const code = await status(`${ORIGIN}${other}`);
  check(
    `${ORIGIN}${other} (other shape) -> NOT 200`,
    code !== 200,
    `got ${code} — if this is 200 the flag should be ${!KEEPS_PREFIX}`,
  );
}

// 3 — A real asset must load, and its path shape must match the flag.
//
// With KEEPS_PREFIX=false the HTML must reference ROOT-relative assets
// (`/_next/...`). That is the whole point of building without `basePath`: asset
// URLs are origin-root relative, so they work on any host and the proxy needs
// only one prefix-strip rule.
const rootRes = await get(`${ORIGIN}${originFor("/")}`);
const html = await rootRes.text();

const assetPattern = KEEPS_PREFIX
  ? /(?:src|href)="(\/protocol\/_next\/[^"]+)"/
  : /(?:src|href)="(\/_next\/[^"]+)"/;
const assetMatch = html.match(assetPattern);

check(
  KEEPS_PREFIX
    ? "origin HTML references /protocol/_next/... assets"
    : "origin HTML references root-relative /_next/... assets",
  Boolean(assetMatch),
  assetMatch ? "" : "no asset reference found in the expected shape",
);

if (assetMatch) {
  const code = await status(`${ORIGIN}${assetMatch[1]}`);
  check(
    `real asset loads (${assetMatch[1].slice(0, 46)}…)`,
    code === 200,
    `got ${code}`,
  );
}

// 4 — No prefixed assets when the flag is false. A stray prefix here means the
//     build still has `basePath` set, and the browser would 404 every chunk.
if (!KEEPS_PREFIX) {
  check(
    "no /protocol/_next/ asset refs (build has basePath unset)",
    !/(?:src|href)="\/protocol\/_next\//.test(html),
    "found a prefixed asset ref — the deployment was likely built with NEXT_PUBLIC_BASE_PATH=/protocol",
  );
}

// 5 — The app's identity, so we are certain this is Protocol Atlas.
check(
  "origin serves Protocol Atlas",
  /Protocol Atlas/i.test(html) && /data actually moves/i.test(html),
  `title=${(html.match(/<title>([^<]*)/) || [])[1] ?? "?"}`,
);

// 6 — The public canonical must survive the proxy. The app is mounted at its
//     origin's root, so this URL is NOT derivable from the request path — it has
//     to come from PUBLIC_PATH_PREFIX.
check(
  "canonical points at the public portfolio URL",
  /<link rel="canonical" href="https:\/\/shriful\.tech\/protocol"/.test(html),
  `canonical=${(html.match(/<link rel="canonical" href="([^"]*)/) || [])[1] ?? "none"}`,
);

console.log("\n=== Live origin check ===\n");
console.log(`origin        : ${ORIGIN}`);
console.log(`prefix        : ${PREFIX}`);
console.log(`keeps prefix  : ${KEEPS_PREFIX}\n`);
let passed = 0;
for (const t of results) {
  console.log(`${t.pass ? "PASS" : "FAIL"}   ${t.name}${t.pass ? "" : `\n       -> ${t.detail}`}`);
  if (t.pass) passed++;
}
console.log(`\n${passed}/${results.length} live assertions passed\n`);
process.exit(passed === results.length ? 0 : 1);
