import type { NextConfig } from "next";

/**
 * Protocol Atlas — Next.js configuration.
 *
 * ─── Deployment shape ───────────────────────────────────────────────────────
 *
 * This app does not own a domain. It is published under a path prefix on the
 * owner's portfolio:
 *
 *   https://shriful.tech/protocol            -> this app's "/"
 *   https://shriful.tech/protocol/tcp        -> this app's "/tcp"
 *   https://shriful.tech/protocol/_next/...  -> this app's "/_next/..."
 *
 * A Cloudflare Worker terminates the public URL, strips the `/protocol`
 * prefix, and proxies to the Vercel origin. See `cloudflare/worker.js`.
 *
 * ─── Why `basePath` and not Worker-only stripping ───────────────────────────
 *
 * Next emits asset URLs root-absolute (`/_next/static/...`). With no
 * `basePath`, the browser resolves those against the *apex* domain —
 * `https://shriful.tech/_next/static/...` — which belongs to the portfolio,
 * not to this app. Every JS and CSS request would break.
 *
 * The two workarounds are both worse:
 *   - claim `shriful.tech/_next/*` in the Worker  -> collides with the portfolio
 *   - rewrite HTML and RSC payload bodies         -> fragile against streaming
 *                                                    and edge caching
 *
 * `basePath: "/protocol"` makes Next prefix everything it generates — asset
 * URLs, `<Link>` hrefs, router transitions, the RSC payload — with the same
 * prefix the public URL already has. The HTML is then already correct for the
 * browser, and the Worker's only job is to strip the prefix on the way in.
 *
 * ─── The route/shape invariant ──────────────────────────────────────────────
 *
 * Because `basePath` supplies `/protocol`, the *app-relative* route must be
 * `/tcp` — not `/protocol/tcp`. That is why the dynamic segment lives at
 * `app/[id]/` and not `app/protocol/[id]/`. Getting this wrong produces either
 * `/protocol/protocol/tcp` (route and prefix both say "protocol") or asset
 * URLs pointing at the portfolio.
 *
 * The invariant to preserve:
 *
 *   public URL   = BASE_PATH + app-relative route
 *   origin path  = app-relative route           (after the Worker strips)
 *
 * ─── Source of truth ────────────────────────────────────────────────────────
 *
 * The prefix lives in `src/lib/deployment.ts` and is read from
 * `NEXT_PUBLIC_BASE_PATH`. Both this config and the client fall back to the
 * same defaults: "/protocol" in production, "" in development.
 */

/** Mirrors `normalisePrefix()` in `src/lib/deployment.ts`. */
function resolveBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH;

  if (raw === undefined) {
    return process.env.NODE_ENV === "production" ? "/protocol" : "";
  }

  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "/") return "";

  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "");
}

const basePath = resolveBasePath();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Mount the whole app under the public prefix so that every URL Next
   * generates is already correct for `https://<host><basePath>/...`.
   */
  basePath: basePath || undefined,

  /**
   * Trailing slashes off: `/protocol/tcp` and `/protocol/tcp/` should not be
   * two different cache keys at the edge. Cloudflare serves one canonical form.
   */
  trailingSlash: false,
};

export default nextConfig;
