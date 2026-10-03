/**
 * Protocol Atlas — Cloudflare Worker reverse proxy.
 *
 * ─── What this does ─────────────────────────────────────────────────────────
 *
 * Publishes the Next.js app at `https://shriful.tech/protocol*` while the app
 * itself is deployed on Vercel. The `/protocol` segment stays in the browser's
 * address bar; the Worker strips it before asking the origin.
 *
 *   Browser                          Worker                        Origin (Vercel)
 *   ───────────────────────────────  ────────────────────────────  ─────────────────────
 *   GET /protocol                    strip  -> /                   GET /
 *   GET /protocol/tcp                strip  -> /tcp                GET /tcp
 *   GET /protocol/tcp?_rsc=abc       strip  -> /tcp?_rsc=abc       GET /tcp?_rsc=abc
 *   GET /protocol/_next/static/x.js  strip  -> /_next/static/x.js  GET /_next/static/x.js
 *   GET /protocol/favicon.ico        strip  -> /favicon.ico        GET /favicon.ico
 *   GET /protocol/bogus              strip  -> /bogus              GET /bogus  (404)
 *
 * The mapping is total: everything under `/protocol` is forwarded with the
 * prefix removed, and everything *not* under `/protocol` is left alone so the
 * portfolio keeps working. There is no per-asset special-casing because the
 * rewrite is a single prefix strip.
 *
 * ─── Why no path is special-cased ───────────────────────────────────────────
 *
 * Because the Next.js app is built with `basePath: "/protocol"`, it emits every
 * URL it controls already carrying the prefix — links, script/style tags, and
 * the RSC payload the client router fetches. So `/protocol/_next/...` in the
 * HTML is simply a request that needs the prefix stripped like any other. The
 * app and this Worker agree on exactly one rule: strip the prefix.
 *
 * ─── Trailing slash ─────────────────────────────────────────────────────────
 *
 * `/protocol` and `/protocol/` both map to the origin root, so the bar can be
 * dropped. Next is configured with `trailingSlash: false`, so the origin's
 * canonical form is the bare path.
 *
 * ─── Caching ────────────────────────────────────────────────────────────────
 *
 * `/_next/static/*` is content-hashed and immutable, so it is cached at the
 * edge for a year. Everything else is passed through untouched — HTML and the
 * RSC payload must not be cached by the Worker, or a redeploy would serve a
 * stale build whose chunk filenames no longer exist.
 */

/**
 * Configuration.
 *
 * These are read from the Worker's environment so the same script can front a
 * preview origin, a staging prefix, or production without an edit. Values are
 * declared in `wrangler.jsonc` under `vars`.
 *
 *   PROTOCOL_PREFIX   Public path prefix. Must equal `basePath` in the Next.js
 *                     build (`NEXT_PUBLIC_BASE_PATH`). "/protocol" by default.
 *
 *   PROTOCOL_ORIGIN   Scheme + host of the deployment that serves the app.
 *                     Absolute, no trailing slash.
 *
 *                     Whether the ORIGIN also keeps the prefix depends on how
 *                     that deployment was built — see
 *                     `PROTOCOL_ORIGIN_KEEPS_PREFIX`.
 *
 *   PROTOCOL_ORIGIN_KEEPS_PREFIX
 *                     "true" when the origin serves the app ALREADY under the
 *                     prefix, i.e. the origin's own `basePath` equals
 *                     PROTOCOL_PREFIX. In that case the Worker forwards the path
 *                     unchanged instead of stripping it.
 *
 *                     This is the difference between two real deployments:
 *
 *                       false (default) — origin built with basePath "/protocol"
 *                                         BUT served at its own root, so the
 *                                         Worker strips: /protocol/tcp -> /tcp
 *
 *                       true            — origin built with basePath "/protocol"
 *                                         and served at the apex, so its routes
 *                                         live at /protocol/tcp and the Worker
 *                                         must NOT strip.
 *
 *                     Getting this wrong is invisible except as a wall of 404s:
 *                     both settings produce valid URLs, only one matches the
 *                     origin. Verify with a single `curl` to the origin root
 *                     before choosing.
 *
 *   PORTFOLIO_ORIGIN  Optional. Scheme + host of the portfolio, used for
 *                     requests OUTSIDE the prefix.
 *
 *                     In production this is normally UNSET, because the Worker
 *                     is routed only to `shriful.tech/protocol*` and so never
 *                     receives a portfolio request at all. It exists for the
 *                     workers.dev preview URL, which receives every path.
 *
 *                     There is deliberately no default: guessing a portfolio
 *                     origin would silently proxy a visitor to a host the
 *                     operator never configured.
 */
const DEFAULT_PREFIX = "/protocol";
const DEFAULT_ORIGIN = "https://website-protocol.vercel.app";

/**
 * Normalise the prefix to `""` or `"/segment"`: leading slash, no trailing.
 * Mirrors `normalisePrefix()` in `src/lib/deployment.ts` so the Worker and the
 * app cannot disagree about the shape of the prefix.
 *
 * @param {string | undefined} raw
 */
function resolvePrefix(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") {
    return DEFAULT_PREFIX;
  }
  const trimmed = raw.trim();
  if (trimmed === "/") return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "");
}

/**
 * @param {string | undefined} raw
 */
function resolveOrigin(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") {
    return DEFAULT_ORIGIN;
  }
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Optional origin: `null` when unset, so callers must decide what to do rather
 * than receiving a plausible-looking default.
 *
 * @param {string | undefined} raw
 * @returns {string | null}
 */
function resolveOptionalOrigin(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") return null;
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Whether the origin serves the app under the prefix already.
 *
 * Accepts the common truthy/falsey spellings a `vars` value can take. Unset is
 * `false`, preserving the original strip-the-prefix behaviour.
 *
 * @param {string | boolean | undefined} raw
 */
function resolveKeepsPrefix(raw) {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "boolean") return raw;
  const normalised = raw.trim().toLowerCase();
  return normalised === "true" || normalised === "1" || normalised === "yes";
}

const worker = {
  /**
   * @param {Request} request
   * @param {{
   *   ASSETS?: { fetch: (r: Request) => Promise<Response> },
   *   PROTOCOL_PREFIX?: string,
   *   PROTOCOL_ORIGIN?: string,
   *   PROTOCOL_ORIGIN_KEEPS_PREFIX?: string,
   *   PORTFOLIO_ORIGIN?: string,
   * }} env
   */
  async fetch(request, env) {
    const PREFIX = resolvePrefix(env.PROTOCOL_PREFIX);
    const ORIGIN = resolveOrigin(env.PROTOCOL_ORIGIN);
    const KEEPS_PREFIX = resolveKeepsPrefix(env.PROTOCOL_ORIGIN_KEEPS_PREFIX);
    const url = new URL(request.url);
    const { pathname, search } = url;

    // ---- Not ours: hand off to the portfolio ---------------------------------
    //
    // Delegated to `servePortfolio()` so that no binding is assumed to exist.
    // In production the Worker is routed only to `shriful.tech/protocol*`, so
    // this branch is normally unreachable there — it matters for the
    // workers.dev preview URL, which receives every path.
    if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) {
      return servePortfolio(request, env);
    }

    // ---- Map the public path onto the origin path ----------------------------
    //
    // Two shapes, chosen by PROTOCOL_ORIGIN_KEEPS_PREFIX.
    //
    //   strips      (default)   /protocol/tcp -> /tcp
    //   keeps prefix (true)     /protocol/tcp -> /protocol/tcp
    //
    // Both are legitimate. An origin built with `basePath: "/protocol"` but
    // deployed at its own root serves `/tcp`; the same build on a host whose
    // apex IS the app serves `/protocol/tcp`. The only way to tell them apart is
    // to ask the origin, so this is configuration rather than guesswork.
    let originPath;
    if (KEEPS_PREFIX) {
      originPath = pathname;
    } else if (PREFIX === "") {
      // Empty prefix: the route is already origin-relative.
      originPath = pathname;
    } else {
      originPath = pathname.slice(PREFIX.length);
    }
    if (originPath === "" || originPath === "/") {
      originPath = KEEPS_PREFIX ? PREFIX : "/";
    }

    // Diagnostics: a doubled prefix means the app was built without `basePath`
    // while the Worker is also stripping — fail loudly instead of 404ing.
    if (
      !KEEPS_PREFIX &&
      PREFIX !== "" &&
      originPath.startsWith(`${PREFIX}/`)
    ) {
      return new Response(
        [
          "Misconfigured deployment: the origin path still contains the prefix.",
          "",
          `  incoming : ${pathname}`,
          `  stripped : ${originPath}`,
          "",
          "The Next.js app was probably built without `basePath: \"/protocol\"`.",
          "Rebuild with NEXT_PUBLIC_BASE_PATH=/protocol.",
          "",
          "If the origin genuinely serves the app WITH the prefix, set",
          "PROTOCOL_ORIGIN_KEEPS_PREFIX=true instead — then the Worker stops",
          "stripping and forwards the path unchanged.",
        ].join("\n"),
        { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    const originUrl = new URL(ORIGIN + originPath + search);

    // ---- Build the upstream request ----------------------------------------
    //
    // Headers are copied so that cookies, `Accept: text/x-component` (the RSC
    // fetch), `Accept-Language`, conditional requests and range requests all
    // survive. `Host` is set to the origin's own hostname: Vercel routes on it,
    // and forwarding the proxy's host can make Vercel return its "no such
    // deployment" page.
    const headers = new Headers(request.headers);
    headers.set("host", new URL(ORIGIN).host);
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("cf-worker");

    // Preserve the real client info the origin may want to log or trust.
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-forwarded-for", clientIp);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-forwarded-host", url.host);
    // Record the public path so the origin can build absolute URLs if it needs
    // to, and so logs are traceable back to the address the visitor used.
    headers.set("x-forwarded-prefix", PREFIX);
    headers.set("x-original-path", pathname);

    /** @type {RequestInit} */
    const init = {
      method: request.method,
      headers,
      // `cf` disables Cloudflare's own caching for origin fetches so the
      // immutable-asset rule below is the only caching policy in play.
      redirect: "manual",
    };

    // A body may only be attached to methods that can have one. Attaching it
    // to GET/HEAD throws.
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      // Required by the fetch spec when streaming a request body upstream.
      init.duplex = "half";
    }

    let upstream;
    try {
      upstream = await fetch(originUrl.toString(), init);
    } catch (cause) {
      // The origin could not be reached at all — distinguish this from a 404
      // so the failure is diagnosable rather than looking like a missing page.
      return new Response(
        [
          "502 Bad Gateway: could not reach the origin.",
          "",
          `  origin : ${ORIGIN}`,
          `  path   : ${originPath}`,
          `  error  : ${cause instanceof Error ? cause.message : String(cause)}`,
        ].join("\n"),
        { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    // ---- Rebuild the response ----------------------------------------------
    //
    // `Location` on a redirect is rewritten back into public space, otherwise
    // a redirect from the origin would send the browser to the bare Vercel
    // URL or to a path without the prefix.
    const responseHeaders = new Headers(upstream.headers);
    const location = responseHeaders.get("location");
    if (location) {
      responseHeaders.set(
        "location",
        toPublicLocation(location, originUrl, url, PREFIX),
      );
    }

    // Do not leak the origin hostname.
    responseHeaders.delete("x-vercel-id");
    responseHeaders.delete("x-vercel-cache");
    responseHeaders.delete("server");

    // Content-hashed build output never changes under a given filename.
    //
    // Keyed on the PUBLIC path, not `originPath`: the public path is
    // `/_next/static/...` regardless of whether the origin keeps the prefix, so
    // the rule holds for both shapes. Keying on `originPath` would silently stop
    // matching when PROTOCOL_ORIGIN_KEEPS_PREFIX is true.
    const isImmutableAsset = pathname.startsWith(`${PREFIX}/_next/static/`) ||
      pathname.startsWith("/_next/static/");
    if (isImmutableAsset && upstream.ok) {
      responseHeaders.set(
        "cache-control",
        "public, max-age=31536000, immutable",
      );
    } else if (!isImmutableAsset) {
      // HTML and RSC payloads must revalidate so a redeploy is picked up.
      const existing = responseHeaders.get("cache-control");
      if (!existing || /s-maxage|max-age/.test(existing)) {
        responseHeaders.set("cache-control", "public, max-age=0, must-revalidate");
      }
    }

    // The Worker rewrote the body's meaning (a new path), so the origin's
    // integrity/encoding headers stay but the CSP-less default is fine.
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

export default worker;

/**
 * Map an origin `Location` header back into public space.
 *
 * The origin may answer with three shapes; all three end up absolute on the
 * public origin so the browser never sees the Vercel hostname:
 *
 *   origin-absolute : https://origin.vercel.app/tcp  -> https://shriful.tech/protocol/tcp
 *   site-absolute   : /tcp                           -> https://shriful.tech/protocol/tcp
 *   already public  : /protocol/tcp                  -> https://shriful.tech/protocol/tcp
 *   external        : https://example.com/...        -> unchanged
 *
 * Resolution is done against the *incoming public URL*, not the origin URL,
 * so no origin detail can leak into the Location header.
 *
 * @param {string} location
 * @param {URL} originUrl   The URL that was requested upstream.
 * @param {URL} publicUrl   The URL the browser actually asked for.
 * @param {string} prefix
 */
function toPublicLocation(location, originUrl, publicUrl, prefix) {
  let target;
  try {
    target = new URL(location, originUrl);
  } catch {
    return location;
  }

  // Absolute to some host that is not the origin — a genuine external redirect.
  // A path-only Location always resolves onto the origin, so reaching here with
  // a differing origin means it named a third party explicitly.
  const isOriginAbsolute = target.origin === originUrl.origin;
  if (!isOriginAbsolute && !location.startsWith("/")) {
    return location;
  }

  // Reduce to the origin-relative path, then re-mount it on the public host.
  const path = isOriginAbsolute ? target.pathname : location;
  const suffix = isOriginAbsolute ? target.search + target.hash : "";

  let publicPath = path;
  if (prefix !== "") {
    if (!(path === prefix || path.startsWith(`${prefix}/`))) {
      publicPath = path === "/" ? prefix : `${prefix}${path}`;
    }
  }

  const rewritten = new URL(publicUrl.toString());
  rewritten.pathname = publicPath;
  rewritten.search = suffix ? suffix : "";
  rewritten.hash = "";
  return rewritten.toString();
}

/**
 * Handle a request that is NOT under the protocol prefix.
 *
 * ─── Why this is not just `env.ASSETS.fetch(request)` ────────────────────────
 *
 * The production Worker is attached to `shriful.tech/protocol*` only. On that
 * deployment there is no static-assets binding, so `env.ASSETS` is `undefined`
 * and touching `.fetch` raises:
 *
 *   TypeError: Cannot read properties of undefined (reading 'fetch')
 *
 * The preview URL (`https://<name>.<subdomain>.workers.dev/`) is different: it
 * receives EVERY path, including `/`, so a bare preview visit would hit that
 * same dead branch.
 *
 * ─── Why not `fetch(request)` ────────────────────────────────────────────────
 *
 * `fetch(request)` re-issues the request to the same URL. On workers.dev that
 * is the same Worker, so the request comes straight back and loops until the
 * runtime kills it. Never do this as a fallback.
 *
 * ─── The three cases ─────────────────────────────────────────────────────────
 *
 *   1. ASSETS bound          -> serve the bundled portfolio from the edge.
 *   2. PORTFOLIO_ORIGIN set  -> reverse-proxy to that origin.
 *   3. neither               -> return an explanatory page. Never throw, never
 *                               loop.
 *
 * Case 3 is a real state, not a failure: in production the route means this
 * branch is simply not reached. The page says so, so an operator opening the
 * preview URL understands why it is not the portfolio.
 *
 * @param {Request} request
 * @param {{ ASSETS?: { fetch: (r: Request) => Promise<Response> }, PORTFOLIO_ORIGIN?: string }} env
 */
async function servePortfolio(request, env) {
  // 1 — A static-assets binding, when one is configured.
  if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
    return env.ASSETS.fetch(request);
  }

  // 2 — An explicitly configured portfolio origin.
  const portfolioOrigin = resolveOptionalOrigin(env.PORTFOLIO_ORIGIN);
  if (portfolioOrigin) {
    const url = new URL(request.url);
    const target = new URL(
      url.pathname + url.search,
      `${portfolioOrigin}/`,
    );

    const headers = new Headers(request.headers);
    headers.set("host", new URL(portfolioOrigin).host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-forwarded-host", url.host);
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-forwarded-for", clientIp);

    /** @type {RequestInit} */
    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      init.duplex = "half";
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), init);
    } catch (cause) {
      return textResponse(
        502,
        [
          "502 Bad Gateway: could not reach the portfolio origin.",
          "",
          `  path  : ${url.pathname}`,
          `  error : ${cause instanceof Error ? cause.message : String(cause)}`,
        ].join("\n"),
      );
    }

    // Redirects must stay on the public host, exactly as for the app origin.
    const responseHeaders = new Headers(upstream.headers);
    const location = responseHeaders.get("location");
    if (location) {
      responseHeaders.set("location", toPublicLocation(location, target, url, ""));
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  }

  // 3 — Nothing configured. Explain, do not throw, do not recurse.
  //
  // The protocol paths are listed so a person opening the preview URL
  // immediately sees the address that does work.
  return new Response(
    [
      "Protocol Atlas — Cloudflare Worker preview",
      "",
      "This URL is the Worker's own preview origin, not the portfolio.",
      "",
      "The production deployment for this Worker is routed to:",
      "",
      "    https://shriful.tech/protocol*",
      "",
      "so requests outside /protocol never reach it. This page is what the",
      "Worker returns when it is invoked directly and has no portfolio to",
      "hand the request to.",
      "",
      "The application is served at:",
      "",
      `    https://shriful.tech/protocol`,
      `    https://shriful.tech/protocol/tcp`,
      "",
      "On this preview origin you can also try:",
      "",
      `    /protocol`,
      `    /protocol/tcp`,
      "",
      "To make this Worker serve the portfolio too, bind static assets",
      "(`assets.binding`) or set PORTFOLIO_ORIGIN.",
    ].join("\n"),
    {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        // Marker so tests can assert this branch was taken rather than a loop.
        "x-protocol-atlas-fallback": "no-portfolio-origin",
      },
    },
  );
}

/**
 * @param {number} status
 * @param {string} message
 */
function textResponse(status, message) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
