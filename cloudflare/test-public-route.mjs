/**
 * Verifies the PUBLIC deployment at a proxy-fronted prefix.
 *
 * This is an end-to-end check of what a visitor actually experiences:
 * `https://shriful.tech/protocol*`. It is the only suite that exercises the
 * portfolio's proxy layer, so it is the one to run after changing proxy rules.
 *
 *   node cloudflare/test-public-route.mjs
 *   node cloudflare/test-public-route.mjs https://example.com/app   # other origin
 *
 * Read-only: GET/HEAD only.
 */

const BASE = process.argv[2] ?? "https://shriful.tech/protocol";

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass: Boolean(pass), detail });

/**
 * Follow redirects manually so a loop is *observed* rather than hidden behind
 * curl's 50-hop limit. Returns every hop, so a self-redirect is visible.
 */
async function trace(url, maxHops = 6) {
  const hops = [];
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    let res;
    try {
      res = await fetch(current, { redirect: "manual" });
    } catch (error) {
      hops.push({ url: current, error: error.message });
      return { hops, looped: false, error: true };
    }
    hops.push({ url: current, status: res.status });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { hops, looped: false };
      const next = new URL(location, current).toString();
      // A redirect back to a URL already visited is an infinite loop.
      if (hops.some((h) => h.url === next)) {
        hops.push({ url: next, status: "(already visited)" });
        return { hops, looped: true };
      }
      current = next;
      continue;
    }
    return { hops, looped: false, final: { url: current, status: res.status, res } };
  }
  return { hops, looped: false, exhausted: true };
}

// 1 — The app root must resolve to 200 WITHOUT looping.
//
// `/prefix` is the classic casualty: a `/prefix/*` wildcard does not match the
// bare path, so it falls through and can self-redirect forever.
{
  const { hops, looped, final, exhausted } = await trace(BASE);
  check(
    `GET ${BASE} resolves without looping`,
    !looped && !exhausted,
    looped
      ? `infinite redirect: ${hops.map((h) => h.url).join(" -> ")}`
      : exhausted
        ? "still redirecting after 6 hops"
        : "",
  );
  check(
    `GET ${BASE} -> 200`,
    final?.status === 200,
    looped ? "looped" : `status ${final?.status ?? "none"}`,
  );

  // The body must be the app, not the portfolio and not an error page.
  if (final?.status === 200) {
    const html = await final.res.text();
    check(
      "  body is Protocol Atlas",
      /Protocol Atlas/i.test(html),
      `title=${(html.match(/<title>([^<]*)/) ?? [])[1] ?? "?"}`,
    );
    check(
      "  assets are prefix-scoped",
      /\/protocol\/_next\//.test(html),
      "no /protocol/_next/ reference found",
    );
    check(
      "  no doubled prefix",
      !/\/protocol\/protocol\//.test(html),
      "found /protocol/protocol/",
    );
  }
}

// 2 — Every protocol page.
const PAGES = ["tcp", "udp", "http", "https", "i2c", "can"];
for (const page of PAGES) {
  const url = `${BASE}/${page}`;
  const { looped, final } = await trace(url);
  check(
    `GET ${BASE}/${page} -> 200`,
    !looped && final?.status === 200,
    looped ? "looped" : `status ${final?.status ?? "none"}`,
  );
}

// 3 — An asset must load through the proxy and be cacheable.
{
  const { final } = await trace(BASE);
  if (final?.status === 200) {
    const html = await final.res.text();
    const asset = html.match(/(?:src|href)="(\/protocol\/_next\/[^"]+)"/);
    if (asset) {
      const url = new URL(asset[1], BASE).toString();
      const res = await fetch(url, { method: "HEAD" });
      check(
        `asset ${asset[1].slice(0, 40)}… -> 200`,
        res.status === 200,
        `status ${res.status}`,
      );
    } else {
      check("asset discoverable in HTML", false, "none found");
    }
  }
}

// 4 — The Vercel hostname must never be exposed.
{
  const { final } = await trace(BASE);
  if (final?.status === 200) {
    const html = await final.res.text();
    check(
      "Vercel hostname not exposed in HTML",
      !/vercel\.app/i.test(html),
      "vercel.app found in body",
    );
  }
}

console.log("\n=== Public route check ===\n");
console.log(`base: ${BASE}\n`);
let passed = 0;
for (const t of results) {
  console.log(`${t.pass ? "PASS" : "FAIL"}   ${t.name}${t.pass ? "" : `\n       -> ${t.detail}`}`);
  if (t.pass) passed++;
}
console.log(`\n${passed}/${results.length} public-route assertions passed\n`);
process.exit(passed === results.length ? 0 : 1);
