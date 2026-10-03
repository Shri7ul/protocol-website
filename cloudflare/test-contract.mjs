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

let ok = 0;
const rows = [];

for (const [publicPath, expected] of CONTRACT) {
  await worker.fetch(new Request(`https://shriful.tech${publicPath}`), env);
  const actual = seen[seen.length - 1];
  const pass = actual === expected;
  if (pass) ok++;
  rows.push({ publicPath, expected, actual, pass });
}

console.log("\n=== Production routing contract ===\n");
for (const r of rows) {
  const mark = r.pass ? "PASS" : "FAIL";
  const note = r.pass ? "" : `   (expected ${r.expected})`;
  console.log(`${mark}   ${r.publicPath.padEnd(36)} -> ${r.actual}${note}`);
}
console.log(`\n${ok}/${rows.length} contract rows correct\n`);

origin.close();
process.exit(ok === rows.length ? 0 : 1);
