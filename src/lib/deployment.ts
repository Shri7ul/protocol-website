/**
 * Deployment configuration.
 *
 * One place that knows *where* this app is published. Everything else derives
 * from it — the canonical metadata URLs.
 *
 * ─── The shape ──────────────────────────────────────────────────────────────
 *
 * The app is deployed to Vercel and owns the root of its own domain. There is
 * no reverse proxy, no `basePath`, and no path prefix:
 *
 *   https://website-protocol-ten.vercel.app/       -> the landing page
 *   https://website-protocol-ten.vercel.app/tcp    -> the TCP presentation
 *   https://website-protocol-ten.vercel.app/can    -> the CAN presentation
 *
 * Because the app is mounted at `/` on whatever host serves it, every route is
 * simply `/<id>` and every asset is `/_next/...`. Nothing needs rewriting in
 * transit, and the deployment URL can be opened directly.
 *
 * ─── Environment variables ──────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_SITE_ORIGIN   Absolute origin used for canonical and Open Graph
 *                             URLs, with no trailing slash. Defaults to the
 *                             Vercel deployment. Set this to a custom domain
 *                             later if one is ever attached — no other change
 *                             is required, because nothing else hard-codes a
 *                             hostname.
 *
 * Read while the module is evaluated, so on the client these values are inlined
 * at build time.
 */

/** Absolute origin, without a trailing slash. */
export const SITE_ORIGIN: string = (
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://website-protocol-ten.vercel.app"
).replace(/\/+$/, "");

/**
 * Absolute URL of the app root.
 *
 * With no path prefix this is simply the origin. It exists as a named export so
 * that pages never build a URL by string-concatenating a hostname.
 */
export const SITE_URL: string = SITE_ORIGIN;
