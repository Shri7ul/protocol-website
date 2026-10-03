/**
 * Deployment configuration.
 *
 * One place that knows *where* this app is published. Everything else derives
 * from it — the Next.js `basePath`, the canonical metadata URLs, and the
 * pathname normalisation in the header.
 *
 * ─── The shape (two hosts, on purpose) ──────────────────────────────────────
 *
 *   Origin (Vercel/Netlify)      https://website-protocol-ten.vercel.app
 *     /                          -> the app root      200  <-- works directly
 *     /tcp                       -> the TCP page      200  <-- works directly
 *
 *   Public (portfolio domain)    https://shriful.tech/protocol
 *     /protocol                  -> the app root      200
 *     /protocol/tcp              -> the TCP page      200
 *
 * **The app is built at its own ROOT (`basePath` unset).** So a bare Vercel or
 * Netlify deploy serves the whole app at `/` with no prefix and no proxy — open
 * the deployment URL and it just works. The `/protocol` segment exists ONLY on
 * the portfolio domain, where the Cloudflare Worker adds it.
 *
 * ─── Why basePath is empty, and what the prefix is for ──────────────────────
 *
 * These are two separate concerns and conflating them was the earlier mistake:
 *
 *   basePath          Where the app is mounted on ITS OWN origin. Always "".
 *   PUBLIC_PATH_PREFIX  Where the app appears on the PORTFOLIO. "/protocol".
 *
 * `basePath: "/protocol"` made the origin 404 at `/` — nothing is mounted at the
 * apex of a subpath-mounted app — which is exactly the "deployed but shows
 * nothing" symptom. It also forced the Worker into prefix-preserving mode, so
 * the origin could never be opened directly.
 *
 * With `basePath: ""` the Worker does the prefixing instead: it strips
 * `/protocol` and forwards to the origin root. That works because the origin
 * serves the app at `/`, so a single prefix strip is a total mapping.
 *
 * ─── Environment variables ──────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_BASE_PATH        Mount point ON THIS ORIGIN. Leave unset ("").
 *                                Only set it if you deliberately want to mount
 *                                the app under a subpath on its own host.
 *
 *   NEXT_PUBLIC_PUBLIC_PATH_PREFIX
 *                                The prefix on the PUBLIC portfolio domain.
 *                                Defaults to "/protocol". Metadata only — it
 *                                affects canonical/OG URLs, never asset paths,
 *                                so the build stays portable.
 *
 *   NEXT_PUBLIC_SITE_ORIGIN      Public origin, no trailing slash.
 *                                Defaults to "https://shriful.tech".
 *
 * These are read while the module is evaluated, so on the client they are
 * inlined at build time.
 */

/**
 * Prefix for generated asset URLs and in-app links.
 *
 * Empty on purpose: the app owns its origin's root. See the file header.
 * Override only if this origin really does mount the app under a subpath.
 */
export const BASE_PATH: string = normalisePrefix(
  process.env.NEXT_PUBLIC_BASE_PATH,
);

/**
 * Where the app appears on the PUBLIC (portfolio) domain.
 *
 * This is metadata, not routing: it is used for canonical URLs and Open Graph,
 * and it must NOT reach asset paths or in-app `href`s — those are origin-root
 * relative so the same build works on any host.
 *
 * Defaults to "/protocol" (the portfolio mount). Unset it only if the app is
 * published at the portfolio's root, which it is not.
 */
const DEFAULT_PUBLIC_PATH_PREFIX = "/protocol";

export const PUBLIC_PATH_PREFIX: string = normalisePrefix(
  process.env.NEXT_PUBLIC_PUBLIC_PATH_PREFIX ?? DEFAULT_PUBLIC_PATH_PREFIX,
);

/** Public origin, without a trailing slash. */
export const SITE_ORIGIN: string = (
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shriful.tech"
).replace(/\/+$/, "");

/** Absolute public URL of the app root, e.g. "https://shriful.tech/protocol". */
export const SITE_URL: string = `${SITE_ORIGIN}${PUBLIC_PATH_PREFIX}`;

function normalisePrefix(raw: string | undefined): string {
  if (raw === undefined) return "";

  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "/") return "";

  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "");
}

/**
 * Remove the deployment prefix from a pathname.
 *
 * With `basePath: ""` this is normally the identity function — `usePathname()`
 * returns app-relative paths already. It remains because it is the single place
 * that knows how to normalise, so if the app is ever mounted under a subpath on
 * its own origin (by setting `NEXT_PUBLIC_BASE_PATH`), every caller keeps
 * working without a change.
 *
 *   BASE_PATH = ""           stripBasePath("/tcp")          -> "/tcp"
 *   BASE_PATH = "/protocol"  stripBasePath("/protocol/tcp") -> "/tcp"
 *   BASE_PATH = "/protocol"  stripBasePath("/protocol")     -> "/"
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
