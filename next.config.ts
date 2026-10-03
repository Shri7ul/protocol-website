import type { NextConfig } from "next";

/**
 * Protocol Atlas — Next.js configuration.
 *
 * ─── Deployment shape ───────────────────────────────────────────────────────
 *
 * The app is built at its OWN ROOT. A bare Vercel/Netlify deploy serves the
 * whole app at `/` with no prefix and no proxy:
 *
 *   https://website-protocol-ten.vercel.app/       -> app root   200
 *   https://website-protocol-ten.vercel.app/tcp    -> TCP page   200
 *
 * The `/protocol` prefix exists ONLY on the portfolio domain, where the
 * Cloudflare Worker adds it:
 *
 *   https://shriful.tech/protocol      -> Worker strips -> origin /
 *   https://shriful.tech/protocol/tcp  -> Worker strips -> origin /tcp
 *
 * ─── Why `basePath` is NOT set here ─────────────────────────────────────────
 *
 * Setting `basePath: "/protocol"` mounts everything under `/protocol` **on this
 * origin too**, so the deployment's own root returns 404:
 *
 *   /            -> 404   (nothing is mounted at the apex)
 *   /protocol    -> 200
 *
 * That is the "deployed but the link shows nothing" symptom. It also forces the
 * Worker into prefix-preserving mode, so the origin can never be opened
 * directly — the deployment only exists behind the proxy.
 *
 * With no `basePath`, the prefix becomes the proxy's job alone. That works
 * because the origin serves the app at `/`, so stripping `/protocol` is a total
 * mapping: one rule covers pages, RSC payloads, and assets alike.
 *
 * ─── The invariant ──────────────────────────────────────────────────────────
 *
 *   origin path  = app-relative route            (the app's own root)
 *   public URL   = PUBLIC_PATH_PREFIX + origin path
 *
 * `PUBLIC_PATH_PREFIX` (default "/protocol") is metadata only — canonical and
 * Open Graph URLs. It must never reach asset paths or in-app `href`s, or the
 * build stops being portable across hosts. It is validated from the build
 * output by `npm run test:deployment`.
 *
 * ─── If you ever DO want a subpath on this origin ───────────────────────────
 *
 * Set `NEXT_PUBLIC_BASE_PATH=/protocol` and the app mounts under it again —
 * then the Worker must run with `PROTOCOL_ORIGIN_KEEPS_PREFIX=true`, because the
 * origin serves `/protocol/tcp` rather than `/tcp`. The two settings must agree;
 * that pairing is asserted by `cloudflare/validate-config.mjs`.
 */

/** Mirrors `normalisePrefix()` in `src/lib/deployment.ts`. */
function resolveBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH;

  if (raw === undefined) return "";

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
   * Unset by default — the app owns its origin's root. Only set this if you
   * deliberately want the app mounted under a subpath on its own host, in which
   * case the Worker's `PROTOCOL_ORIGIN_KEEPS_PREFIX` must flip to `true`.
   */
  basePath: basePath || undefined,

  /**
   * Trailing slashes off: `/tcp` and `/tcp/` should not be two different cache
   * keys at the edge. Cloudflare serves one canonical form.
   */
  trailingSlash: false,
};

export default nextConfig;
