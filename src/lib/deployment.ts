/**
 * Deployment configuration.
 *
 * One place that knows *where* this app is published. Everything else derives
 * from it — the Next.js `basePath`, the canonical metadata URLs, and the
 * pathname normalisation in the header.
 *
 * ─── The shape ──────────────────────────────────────────────────────────────
 *
 *   Public origin   https://shriful.tech
 *   Public prefix   /protocol
 *   ────────────────────────────────────────────────
 *   /                          -> https://shriful.tech/protocol
 *   /tcp                       -> https://shriful.tech/protocol/tcp
 *
 * The Vercel deployment is an implementation detail and is never linked to.
 *
 * ─── Environment variables ──────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_BASE_PATH   Public path prefix. "" or "/protocol".
 *                           Defaults to "/protocol" in production, "" in dev.
 *
 *   NEXT_PUBLIC_SITE_ORIGIN Public origin, no trailing slash.
 *                           Defaults to "https://shriful.tech".
 *
 * These are read while the module is evaluated, so on the client they are
 * inlined at build time. That is required: `basePath` is baked in at build
 * time too, and the two must agree.
 */

/** Prefix this app is mounted at on the public origin. */
export const BASE_PATH: string = normalisePrefix(
  process.env.NEXT_PUBLIC_BASE_PATH,
);

/** Public origin, without a trailing slash. */
export const SITE_ORIGIN: string = (
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shriful.tech"
).replace(/\/+$/, "");

/** Absolute public URL of the app root, e.g. "https://shriful.tech/protocol". */
export const SITE_URL: string = `${SITE_ORIGIN}${BASE_PATH}`;

function normalisePrefix(raw: string | undefined): string {
  // Unset: production is published under the prefix, local dev is not.
  if (raw === undefined) {
    return process.env.NODE_ENV === "production" ? "/protocol" : "";
  }

  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "/") return "";

  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "");
}

/**
 * Remove the deployment prefix from a pathname.
 *
 * `usePathname()` returns the location **including** `basePath`, so a route
 * that is `/tcp` in the app arrives as `/protocol/tcp`. Any comparison against
 * an app-relative route has to normalise first or the header's active state
 * silently stops matching.
 *
 *   stripBasePath("/protocol/tcp") -> "/tcp"
 *   stripBasePath("/protocol")     -> "/"
 *   stripBasePath("/tcp")          -> "/tcp"   (dev, no prefix)
 */
export function stripBasePath(pathname: string | null): string {
  if (!pathname) return "/";
  if (!BASE_PATH) return pathname;

  if (pathname === BASE_PATH) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length) || "/";
  }

  return pathname;
}
