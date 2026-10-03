/**
 * Contract check: every row of the production routing table.
 *
 * Asserts that the public URL the spec names maps to exactly the expected
 * origin path, using a production-like env with NO ASSETS binding.
 *
 *   node cloudflare/test-contract.mjs
 */

import http from "node:http";

const PORT = 8795;
const seen = [];

const origin = http.createServer((req, res) => {
  seen.push(req.url);
  res.writeHead(200, { "content-type": "text/html" });
  res.end("ok");
});
await new Promise((resolve) => origin.listen(PORT, resolve));

const { default: worker } = await import(
  new URL("./worker.js", import.meta.url).href
);

/** Production-like: no ASSETS binding, no portfolio origin. */
const env = {
  PROTOCOL_PREFIX: "/protocol",
  PROTOCOL_ORIGIN: `http://127.0.0.1:${PORT}`,
};

/**
 * The contract from the deployment requirement, transcribed literally.
 *
 * NOTE the right-hand column is the ORIGIN path. The app is built with
 * `basePath` UNSET, so the origin (`website-protocol-ten.vercel.app`) serves the
 * app at its own root — verified: `/` and `/tcp` are 200 while `/protocol` is
 * 404. So the Worker STRIPS the prefix and every expected value below is
 * prefix-free.
 *
 * This is the default shape (`PROTOCOL_ORIGIN_KEEPS_PREFIX` unset/false) and
 * the one in production.
 */
const CONTRACT = [
  ["/protocol", "/"],
  ["/protocol/tcp", "/tcp"],
  ["/protocol/udp", "/udp"],
  ["/protocol/http", "/http"],
  ["/protocol/https", "/https"],
  ["/protocol/i2c", "/i2c"],
  ["/protocol/can", "/can"],
  ["/protocol/_next/static/chunks/x.js", "/_next/static/chunks/x.js"],
  ["/protocol/_next/static/css/y.css", "/_next/static/css/y.css"],
];

/**
 * The same public URLs when the origin DOES keep the prefix — i.e. the app was
 * rebuilt with `NEXT_PUBLIC_BASE_PATH=/protocol` and therefore mounts under it
 * on its own host too.
 *
 * This shape is NOT in production; it is preserved because the flag is a real
 * supported configuration and both mappings must stay correct. If it is ever
 * selected, `wrangler.jsonc` must set `PROTOCOL_ORIGIN_KEEPS_PREFIX: "true"` —
 * `cloudflare/validate-config.mjs` asserts that pairing.
 */
const envKeepsPrefix = { ...env, PROTOCOL_ORIGIN_KEEPS_PREFIX: "true" };

const CONTRACT_KEEPS_PREFIX = [
  ["/protocol", "/protocol"],
  ["/protocol/tcp", "/protocol/tcp"],
  ["/protocol/can", "/protocol/can"],
  ["/protocol/_next/static/chunks/x.js", "/protocol/_next/static/chunks/x.js"],
];

let ok = 0;
const rows = [];

for (const [publicPath, expected] of CONTRACT) {
  await worker.fetch(
    new Request(`https://shriful.tech${publicPath}`),
    env,
  );
  const actual = seen[seen.length - 1];
  const pass = actual === expected;
  if (pass) ok++;
  rows.push({ publicPath, expected, actual, pass, mode: "strips prefix (production)" });
}

for (const [publicPath, expected] of CONTRACT_KEEPS_PREFIX) {
  await worker.fetch(
    new Request(`https://shriful.tech${publicPath}`),
    envKeepsPrefix,
  );
  const actual = seen[seen.length - 1];
  const pass = actual === expected;
  if (pass) ok++;
  rows.push({ publicPath, expected, actual, pass, mode: "keeps prefix (alternate)" });
}

console.log("\n=== Production routing contract ===\n");
let currentMode = null;
for (const r of rows) {
  if (r.mode !== currentMode) {
    currentMode = r.mode;
    console.log(`-- ${currentMode} --`);
  }
  const mark = r.pass ? "PASS" : "FAIL";
  const note = r.pass ? "" : `   (expected ${r.expected})`;
  console.log(`${mark}   ${r.publicPath.padEnd(36)} -> ${r.actual}${note}`);
}
console.log(`\n${ok}/${rows.length} contract rows correct\n`);

origin.close();
process.exit(ok === rows.length ? 0 : 1);
