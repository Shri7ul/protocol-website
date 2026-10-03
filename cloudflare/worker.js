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
 * declared in `wrangler.jsonc` under `vars` — see that file for the defaults
 * this app ships with.
 *
 *   PROTOCOL_PREFIX  Public path prefix. Must equal `basePath` in the Next.js
 *                    build (`NEXT_PUBLIC_BASE_PATH`). "/protocol" by default.
 *
 *   PROTOCOL_ORIGIN  Scheme + host of the deployment that serves the app. Must
 *                    be absolute and must NOT carry the prefix — the prefix is
 *                    applied by this Worker, not by the origin.
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

const worker = {
  /**
   * @param {Request} request
   * @param {{
   *   ASSETS: { fetch: (r: Request) => Promise<Response> },
   *   PROTOCOL_PREFIX?: string,
   *   PROTOCOL_ORIGIN?: string,
   * }} env
   */
  async fetch(request, env) {
    const PREFIX = resolvePrefix(env.PROTOCOL_PREFIX);
    const ORIGIN = resolveOrigin(env.PROTOCOL_ORIGIN);
    const url = new URL(request.url);
    const { pathname, search } = url;

    // ---- Not ours: let Cloudflare fall through to the portfolio -------------
    //
    // Returning `env.ASSETS.fetch(request)` serves the Worker's own static
    // assets (the portfolio build, if this Worker is bound to it). Swap this
    // for `fetch(request)` if the portfolio lives on a different origin.
    if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) {
      return env.ASSETS.fetch(request);
    }

    // ---- Strip the prefix ---------------------------------------------------
    //
    // `/protocol`      -> "/"
    // `/protocol/`     -> "/"
    // `/protocol/tcp`  -> "/tcp"
    //
    // With an empty prefix (PROTOCOL_PREFIX aiming at the origin root) the
    // route is already origin-relative, so nothing is sliced.
    let originPath = PREFIX === "" ? pathname : pathname.slice(PREFIX.length);
    if (originPath === "" || originPath === "/") {
      originPath = "/";
    }

    // A path that reached here with a doubled prefix means the app was built
    // without `basePath` — fail loudly instead of silently 404ing.
    if (PREFIX !== "" && originPath.startsWith(`${PREFIX}/`)) {
      return new Response(
        [
          "Misconfigured deployment: the origin path still contains the prefix.",
          "",
          `  incoming : ${pathname}`,
          `  stripped : ${originPath}`,
          "",
          "The Next.js app was probably built without `basePath: \"/protocol\"`.",
          "Rebuild with NEXT_PUBLIC_BASE_PATH=/protocol.",
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
    const isImmutableAsset = originPath.startsWith("/_next/static/");
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
