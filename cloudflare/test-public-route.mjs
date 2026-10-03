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

/**
 * Summarise a redirect chain for an assertion message.
 *
 * A bare "status 307" hides the only thing that matters: *where* the request
 * was sent. The common real-world failure here is a host redirect (apex ->
 * `www`) that answers before the proxy does, which looks identical to a plain
 * non-200 unless the chain is printed.
 */
function describeHops(hops) {
  const steps = hops.filter((h) => h.status).map((h) => h.status);
  if (steps.length <= 1) return "";
  return ` after ${steps.length - 1} redirect(s): ${steps.join(" -> ")}`;
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
    looped ? "looped" : `status ${final?.status ?? "none"}${describeHops(hops)}`,
  );

  // The body must be the app, not the portfolio and not an error page.
  if (final?.status === 200) {
    const html = await final.res.text();
    check(
      "  body is Protocol Atlas",
      /Protocol Atlas/i.test(html),
      `title=${(html.match(/<title>([^<]*)/) ?? [])[1] ?? "?"}`,
    );
    /**
     * Assets must be ROOT-relative (`/_next/...`), not prefix-scoped.
     *
     * The app is built without `basePath`, so it emits origin-root asset URLs
     * and the proxy's prefix-strip rule turns `/protocol/_next/x.js` into
     * `/_next/x.js`. `/_next/...` in the served HTML is therefore correct.
     *
     * What would be wrong is `/protocol/_next/...` — that means the build still
     * has `basePath` set, and the browser would request a path the stripped
     * origin does not serve.
     */
    check(
      "  assets are root-relative (build has basePath unset)",
      /(?:src|href)="\/_next\//.test(html),
      "no root-relative /_next/ reference found in the served HTML",
    );
    check(
      "  no prefix-scoped asset refs",
      !/(?:src|href)="\/protocol\/_next\//.test(html),
      "found /protocol/_next/ — the deployment was likely built with NEXT_PUBLIC_BASE_PATH=/protocol",
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
//
// The HTML carries root-relative refs (`/_next/...`), so through the PUBLIC
// origin the path must be re-prefixed to `PUBLIC_BASE + /_next/...` — that is
// what the proxy strips again on the way in. Testing the bare `/_next/...`
// against the portfolio domain would hit the portfolio, not this app.
{
  const { final } = await trace(BASE);
  if (final?.status === 200) {
    const html = await final.res.text();
    const asset = html.match(/(?:src|href)="(\/_next\/[^"]+)"/);
    if (asset) {
      const url = new URL(asset[1], BASE).toString();
      const res = await fetch(url, { method: "HEAD" });
      check(
        `asset ${asset[1].slice(0, 40)}… -> 200`,
        res.status === 200,
        `status ${res.status} (via ${url})`,
      );
    } else {
      check("asset discoverable in HTML", false, "no root-relative /_next/ ref found");
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
