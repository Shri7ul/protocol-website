/**
 * Behavioural test for `worker.js`.
 *
 * Runs the Worker in plain Node against a stub "Vercel origin" and asserts the
 * routing contract: prefix stripping, query preservation, Host handling,
 * non-protocol handling, redirect rewriting, caching policy, and the
 * misconfiguration diagnostic.
 *
 *   node cloudflare/test-worker.mjs
 *
 * Exits non-zero if any assertion fails.
 */

import http from "node:http";

const ORIGIN_PORT = 8791;
const PORTFOLIO_PORT = 8792;

/** Every request the stub origin received. */
const seen = [];

/** Every request the stub portfolio origin received. */
const seenPortfolio = [];

const origin = http.createServer((req, res) => {
  seen.push({ url: req.url, host: req.headers.host });

  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><h1>origin root</h1>");
    return;
  }
  if (req.url.startsWith("/_next/static/")) {
    res.writeHead(200, { "content-type": "application/javascript" });
    res.end("console.log('chunk')");
    return;
  }
  if (req.url === "/tcp" || req.url.startsWith("/tcp?")) {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><h1>tcp</h1>");
    return;
  }
  if (req.url === "/redirect") {
    res.writeHead(307, { location: "/tcp" });
    res.end();
    return;
  }
  if (req.url === "/redirect-absolute") {
    res.writeHead(308, {
      location: `http://127.0.0.1:${ORIGIN_PORT}/_next/static/chunks/x.js`,
    });
    res.end();
    return;
  }
  if (req.url === "/redirect-external") {
    res.writeHead(302, { location: "https://example.com/elsewhere" });
    res.end();
    return;
  }
  if (req.url === "/vercel-headers") {
    res.writeHead(200, {
      "content-type": "text/html",
      "x-vercel-id": "iad1::abc",
      "x-vercel-cache": "HIT",
      server: "Vercel",
    });
    res.end("ok");
    return;
  }

  res.writeHead(404, { "content-type": "text/html" });
  res.end("not found");
});

await new Promise((resolve) => origin.listen(ORIGIN_PORT, resolve));

/**
 * Stub portfolio origin. Requests outside the protocol prefix are proxied
 * here when PORTFOLIO_ORIGIN is configured.
 */
const portfolio = http.createServer((req, res) => {
  seenPortfolio.push({ url: req.url, host: req.headers.host });
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<!doctype html><h1>portfolio ${req.url}</h1>`);
});
await new Promise((resolve) => portfolio.listen(PORTFOLIO_PORT, resolve));

const { default: worker } = await import(
  new URL("./worker.js", import.meta.url).href
);

const PORTFOLIO_ORIGIN = `http://127.0.0.1:${PORTFOLIO_PORT}`;

const env = {
  PROTOCOL_PREFIX: "/protocol",
  PROTOCOL_ORIGIN: `http://127.0.0.1:${ORIGIN_PORT}`,
  PORTFOLIO_ORIGIN,
  ASSETS: {
    fetch: async (req) => {
      const pathname = new URL(req.url).pathname;
      return new Response(`<!doctype html><h1>portfolio ${pathname}</h1>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  },
};

/**
 * Production-like environment: NO ASSETS binding.
 *
 * This mirrors the real deployment. The Worker is attached only to
 * `shriful.tech/protocol*`, so it has no static-assets binding at all. Any code
 * path that touches `env.ASSETS` will throw a TypeError here — which is exactly
 * the reported production-preview failure.
 */
const envNoAssets = {
  PROTOCOL_PREFIX: "/protocol",
  PROTOCOL_ORIGIN: `http://127.0.0.1:${ORIGIN_PORT}`,
  PORTFOLIO_ORIGIN,
};

/** Preview environment: no ASSETS binding AND no portfolio origin. */
const envPreviewBare = {
  PROTOCOL_PREFIX: "/protocol",
  PROTOCOL_ORIGIN: `http://127.0.0.1:${ORIGIN_PORT}`,
};

/** Preview root request, as typed into the browser. */
const PREVIEW_ROOT = "https://protocol.smislam5959.workers.dev/";
/** Preview protocol request. */
const PREVIEW_TCP = "https://protocol.smislam5959.workers.dev/protocol/tcp";

const call = (path, init) =>
  worker.fetch(new Request(`http://shriful.tech${path}`, init), env);

const last = () => seen[seen.length - 1];

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass: Boolean(pass), detail });

// 1 — prefix root maps to origin root.
let res = await call("/protocol");
let body = await res.text();
check(
  "GET /protocol            -> origin /",
  last().url === "/" && body.includes("origin root"),
  `origin saw ${last().url}`,
);

// 2 — trailing slash collapses.
res = await call("/protocol/");
await res.text();
check("GET /protocol/           -> origin /", last().url === "/", `origin saw ${last().url}`);

// 3 — protocol page.
res = await call("/protocol/tcp");
body = await res.text();
check(
  "GET /protocol/tcp        -> origin /tcp",
  last().url === "/tcp" && body.includes("tcp"),
  `origin saw ${last().url}`,
);

// 4 — asset passthrough + immutable caching.
res = await call("/protocol/_next/static/chunks/abc.js");
await res.text();
check(
  "GET /protocol/_next/...  -> origin /_next/...",
  last().url === "/_next/static/chunks/abc.js",
  `origin saw ${last().url}`,
);
check(
  "  immutable caching on /_next/static/",
  res.headers.get("cache-control") === "public, max-age=31536000, immutable",
  `got ${res.headers.get("cache-control")}`,
);

// 5 — query string carried through (this is the RSC fetch).
res = await call("/protocol/tcp?_rsc=abc123");
await res.text();
check(
  "query string preserved   (? _rsc=)",
  last().url === "/tcp?_rsc=abc123",
  `origin saw ${last().url}`,
);

// 6 — Host rewritten to the origin's own host.
res = await call("/protocol/tcp");
await res.text();
check(
  "Host header = origin host",
  last().host === `127.0.0.1:${ORIGIN_PORT}`,
  `origin saw host ${last().host}`,
);

// 7 — non-/protocol paths never reach the app origin.
//
// `env` has BOTH an ASSETS binding and a PORTFOLIO_ORIGIN. Serving from the
// edge binding is cheaper than a round trip, so ASSETS wins by design and the
// portfolio origin must NOT be contacted.
const beforeCount = seen.length;
const beforePortfolio = seenPortfolio.length;
res = await call("/about");
body = await res.text();
check(
  "GET /about               -> served from ASSETS",
  body.includes("portfolio /about") &&
    seen.length === beforeCount &&
    seenPortfolio.length === beforePortfolio,
  `body=${body.slice(0, 48)} portfolioHits=${seenPortfolio.length - beforePortfolio}`,
);

// 7b — non-protocol handling WITHOUT an ASSETS binding must not throw.
//
// This is the reported failure: `env.ASSETS` is undefined, so the old
// `env.ASSETS.fetch(request)` raised
//   TypeError: Cannot read properties of undefined (reading 'fetch')
let threw = null;
const beforePortfolio7b = seenPortfolio.length;
try {
  res = await worker.fetch(
    new Request("http://shriful.tech/about"),
    envNoAssets,
  );
  body = await res.text();
} catch (error) {
  threw = error;
}
check(
  "no-ASSETS binding: /about does not throw",
  threw === null,
  threw ? `${threw.constructor.name}: ${threw.message}` : "",
);
check(
  "no-ASSETS binding: /about -> PORTFOLIO_ORIGIN",
  threw === null &&
    body.includes("portfolio /about") &&
    seenPortfolio.length === beforePortfolio7b + 1,
  threw
    ? `${threw.constructor.name}`
    : `body=${body?.slice(0, 48)} hits=${seenPortfolio.length - beforePortfolio7b}`,
);

// 8 — origin redirect rewritten into public space (host AND prefix).
res = await call("/protocol/redirect");
check(
  "307 Location -> public host + prefix",
  res.headers.get("location") === "http://shriful.tech/protocol/tcp",
  `got ${res.headers.get("location")}`,
);

// 8b — an absolute origin redirect must not leak the origin hostname.
res = await call("/protocol/redirect-absolute");
check(
  "308 origin-absolute -> public host",
  res.headers.get("location") ===
    "http://shriful.tech/protocol/_next/static/chunks/x.js",
  `got ${res.headers.get("location")}`,
);

// 8c — a genuine external redirect is passed through untouched.
res = await call("/protocol/redirect-external");
check(
  "302 external redirect untouched",
  res.headers.get("location") === "https://example.com/elsewhere",
  `got ${res.headers.get("location")}`,
);

// 9 — origin 404 stays a 404.
res = await call("/protocol/bogus");
await res.text();
check("origin 404 passes through", res.status === 404, `status ${res.status}`);

// 10 — doubled prefix fails loudly instead of 404ing.
res = await worker.fetch(
  new Request("http://shriful.tech/protocol/protocol/tcp"),
  env,
);
body = await res.text();
check(
  "doubled prefix           -> 500 diagnostic",
  res.status === 500 && body.includes("Misconfigured"),
  `status ${res.status}`,
);

// 11 — HTML/RSC must revalidate.
res = await call("/protocol/tcp");
await res.text();
check(
  "HTML cache-control must revalidate",
  /must-revalidate/.test(res.headers.get("cache-control") ?? ""),
  `got ${res.headers.get("cache-control")}`,
);

// 12 — origin identity headers scrubbed.
res = await call("/protocol/vercel-headers");
await res.text();
check(
  "origin host leaked?      no",
  !res.headers.get("x-vercel-id") &&
    !res.headers.get("x-vercel-cache") &&
    !res.headers.get("server"),
  `vercel-id=${res.headers.get("x-vercel-id")} cache=${res.headers.get("x-vercel-cache")} server=${res.headers.get("server")}`,
);

// 13 — prefix configurable to "" (dev-style, no prefix).
const devEnv = { ...env, PROTOCOL_PREFIX: "/" };
res = await worker.fetch(new Request("http://shriful.tech/tcp"), devEnv);
check(
  "PROTOCOL_PREFIX=/        -> prefix disabled",
  res.status === 200,
  `status ${res.status}`,
);

// ---------------------------------------------------------------------------
// workers.dev preview — the reported failure surface
// ---------------------------------------------------------------------------

// 14 — direct preview root, WITH a portfolio origin configured.
//
// The preview URL receives every path. `/` is outside the prefix, so it is
// proxied to PORTFOLIO_ORIGIN — no ASSETS binding required, no throw.
threw = null;
let previewRootStatus = null;
let previewRootBody = "";
try {
  res = await worker.fetch(new Request(PREVIEW_ROOT), envNoAssets);
  previewRootStatus = res.status;
  previewRootBody = await res.text();
} catch (error) {
  threw = error;
}
check(
  "preview / (no ASSETS, has portfolio) does not throw",
  threw === null,
  threw ? `${threw.constructor.name}: ${threw.message}` : "",
);
check(
  "preview / -> PORTFOLIO_ORIGIN",
  threw === null &&
    previewRootStatus === 200 &&
    previewRootBody.includes("portfolio /"),
  `status ${previewRootStatus} body=${previewRootBody.slice(0, 48)}`,
);

// 14b — direct preview root with NOTHING configured must not throw or recurse.
//
// This is the case that previously raised the TypeError. `fetch(request)` is
// never an acceptable fallback here: on workers.dev it would re-enter the same
// Worker and loop.
threw = null;
let bareStatus = null;
let bareBody = "";
let bareHeaders = null;
try {
  res = await worker.fetch(new Request(PREVIEW_ROOT), envPreviewBare);
  bareStatus = res.status;
  bareHeaders = res.headers;
  bareBody = await res.text();
} catch (error) {
  threw = error;
}
check(
  "preview / (nothing configured) does not throw",
  threw === null,
  threw ? `${threw.constructor.name}: ${threw.message}` : "",
);
check(
  "preview / is not a recursive fetch loop",
  threw === null &&
    bareHeaders.get("x-protocol-atlas-fallback") === "no-portfolio-origin",
  `marker=${bareHeaders ? bareHeaders.get("x-protocol-atlas-fallback") : "-"}`,
);
check(
  "preview / returns an explanatory page naming /protocol/tcp",
  threw === null &&
    bareStatus === 200 &&
    bareBody.includes("/protocol/tcp") &&
    bareBody.includes("shriful.tech/protocol"),
  `status ${bareStatus}`,
);

// 15 — direct preview /protocol/tcp must still reverse-proxy correctly.
threw = null;
let previewTcpBody = "";
try {
  res = await worker.fetch(new Request(PREVIEW_TCP), envNoAssets);
  previewTcpBody = await res.text();
} catch (error) {
  threw = error;
}
check(
  "preview /protocol/tcp does not throw",
  threw === null,
  threw ? `${threw.constructor.name}: ${threw.message}` : "",
);
check(
  "preview /protocol/tcp -> origin /tcp",
  threw === null && last().url === "/tcp" && previewTcpBody.includes("tcp"),
  threw ? `${threw.constructor.name}` : `origin saw ${last().url}`,
);

// 17 — the fallback page must not leak the origin host.
check(
  "preview fallback does not leak origin host",
  threw === null && !bareBody.includes(`127.0.0.1:${ORIGIN_PORT}`) &&
    !bareBody.includes(PORTFOLIO_ORIGIN),
  "origin hostname present in fallback body",
);

console.log("\n=== Cloudflare Worker behaviour ===\n");
let passed = 0;
let failed = 0;
for (const t of results) {
  const mark = t.pass ? "PASS" : "FAIL";
  console.log(`${mark}   ${t.name}${t.pass ? "" : `\n       -> ${t.detail}`}`);
  if (t.pass) passed++;
  else failed++;
}
console.log(`\n${passed}/${results.length} assertions passed\n`);

origin.close();
portfolio.close();
process.exit(failed === 0 ? 0 : 1);
