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
 * NOTE the right-hand column is the ORIGIN path, and the real origin
 * (`website-protocol-ten.vercel.app`) serves the app under `/protocol` too —
 * verified: `/protocol/tcp` is 200 while `/tcp` is 404. So the Worker forwards
 * the prefix unchanged, and every expected value below carries it.
 *
 * `PROTOCOL_ORIGIN_KEEPS_PREFIX=true` is what selects this shape. Remove it and
 * the expectations in this file become wrong — which is the point: the flag is
 * load-bearing, not cosmetic.
 */
const envKeepsPrefix = { ...env, PROTOCOL_ORIGIN_KEEPS_PREFIX: "true" };

const CONTRACT = [
  ["/protocol", "/protocol"],
  ["/protocol/tcp", "/protocol/tcp"],
  ["/protocol/udp", "/protocol/udp"],
  ["/protocol/http", "/protocol/http"],
  ["/protocol/https", "/protocol/https"],
  ["/protocol/i2c", "/protocol/i2c"],
  ["/protocol/can", "/protocol/can"],
  ["/protocol/_next/static/chunks/x.js", "/protocol/_next/static/chunks/x.js"],
  ["/protocol/_next/static/css/y.css", "/protocol/_next/static/css/y.css"],
];

/**
 * The same public URLs when the origin does NOT keep the prefix. Preserved so
 * both deployments shapes stay covered.
 */
const CONTRACT_STRIPPING = [
  ["/protocol", "/"],
  ["/protocol/tcp", "/tcp"],
  ["/protocol/can", "/can"],
  ["/protocol/_next/static/chunks/x.js", "/_next/static/chunks/x.js"],
];

let ok = 0;
const rows = [];

for (const [publicPath, expected] of CONTRACT) {
  await worker.fetch(
    new Request(`https://shriful.tech${publicPath}`),
    envKeepsPrefix,
  );
  const actual = seen[seen.length - 1];
  const pass = actual === expected;
  if (pass) ok++;
  rows.push({ publicPath, expected, actual, pass, mode: "keeps prefix" });
}

for (const [publicPath, expected] of CONTRACT_STRIPPING) {
  await worker.fetch(
    new Request(`https://shriful.tech${publicPath}`),
    env,
  );
  const actual = seen[seen.length - 1];
  const pass = actual === expected;
  if (pass) ok++;
  rows.push({ publicPath, expected, actual, pass, mode: "strips prefix" });
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
