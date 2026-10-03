/**
 * Root-mount navigation check.
 *
 * Proves the three requests a real browser makes all resolve correctly when the
 * app is served at its origin's ROOT (no `basePath`):
 *
 *   1. the document request
 *   2. the RSC request a client-side navigation issues (`RSC: 1`)
 *   3. an asset request taken verbatim from the served HTML
 *
 * Requires a production server already listening on the given port:
 *
 *   npx next build && npx next start -p 4471
 *   node cloudflare/check-root-nav.mjs 4471
 *
 * Read-only: GET only.
 */

import http from "node:http";

const PORT = Number(process.argv[2] ?? 4471);

const get = (path, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        path,
        method: "GET",
        headers: { host: `localhost:${PORT}`, ...headers },
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
      },
    );
    req.on("error", reject);
    req.end();
  });

const rows = [];
const check = (n, p, d = "") => rows.push({ n, p: Boolean(p), d });

// --- 1. The root document -------------------------------------------------
let r = await get("/");
check("GET /                          -> 200", r.status === 200, `got ${r.status}`);
check("   root serves Protocol Atlas", /Protocol Atlas/i.test(r.body), "title mismatch");
check("   nav links are root-relative", /href="\/tcp"/.test(r.body), "no /tcp link found");
check(
  "   no prefixed hrefs leak",
  !/href="\/protocol\//.test(r.body),
  "found a /protocol/ href — build still has basePath set",
);

// --- 2. Asset referenced by the root document -----------------------------
const rootAsset = r.body.match(/(?:src|href)="(\/_next\/[^"]+)"/);
check("   asset ref is root-relative", Boolean(rootAsset), "no /_next/ ref found");
if (rootAsset) {
  check(
    "   asset path has no prefix",
    !rootAsset[1].startsWith("/protocol"),
    `got ${rootAsset[1]}`,
  );
  const a = await get(rootAsset[1]);
  check(
    `   asset ${rootAsset[1].slice(0, 44)}… -> 200`,
    a.status === 200,
    `got ${a.status}`,
  );
}

// --- 3. A protocol page, as both a document and an RSC payload ------------
const PAGES = ["/tcp", "/udp", "/http", "/https", "/i2c", "/can"];
for (const page of PAGES) {
  const doc = await get(page);
  check(`GET ${page.padEnd(26)} -> 200`, doc.status === 200, `got ${doc.status}`);
}

/** Client-side navigation fetches the same route with `RSC: 1`. */
r = await get("/tcp", { RSC: "1" });
check("GET /tcp  (RSC: 1)            -> 200", r.status === 200, `got ${r.status}`);
check(
  "   RSC payload has no basePath 'p' field",
  !/"p":"\/protocol"/.test(r.body),
  'found "p":"/protocol" — the RSC payload still carries a basePath',
);
check(
  "   RSC payload assets are root-relative",
  /static\/chunks\/|_next\/static/.test(r.body),
  "no asset reference in RSC payload",
);

// --- 4. The prefix must NOT exist on this origin --------------------------
//
// The prefix is the proxy's job. If the origin answered it, the app would be
// mounted twice and the Worker's strip would be ambiguous.
for (const p of ["/protocol", "/protocol/tcp"]) {
  const bad = await get(p);
  check(`${p.padEnd(31)} -> NOT 200`, bad.status !== 200, `got ${bad.status}`);
}

console.log(`\n=== Root-mount navigation check (port ${PORT}) ===\n`);
let ok = 0;
for (const x of rows) {
  console.log(`${x.p ? "PASS" : "FAIL"}   ${x.n}${x.p ? "" : `\n        -> ${x.d}`}`);
  if (x.p) ok++;
}
console.log(`\n${ok}/${rows.length} root-mount assertions passed\n`);
process.exit(ok === rows.length ? 0 : 1);
