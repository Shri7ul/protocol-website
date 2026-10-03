import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProtocolPresentation } from "@/components/presentation/protocol-presentation";
import { getProtocol, isProtocolId, PROTOCOL_ORDER } from "@/data/registry";
import { SITE_URL } from "@/lib/deployment";

/**
 * Statically generate all six protocol pages at build time.
 *
 * The content is static data — no fetching, no user-specific state — so there
 * is no reason to render these at request time. `generateStaticParams` plus
 * the absence of any dynamic API means these ship as prerendered HTML.
 *
 * The route segment is `[id]`, NOT `protocol/[id]`. The app is mounted at its
 * own origin's root, so the app-relative path is `/tcp`; the `/protocol` segment
 * is added by the reverse proxy on the portfolio domain. Naming the folder
 * `protocol/` would not double anything now, but it would collide if the app
 * were ever mounted under a subpath again.
 *
 * Result:
 *
 *   app-relative route   public URL
 *   /                    https://shriful.tech/protocol
 *   /tcp                 https://shriful.tech/protocol/tcp
 *   /tcp (RSC payload)   https://shriful.tech/protocol/tcp?_rsc=...
 *
 * The Cloudflare Worker strips `/protocol` before forwarding, so the origin
 * (Vercel) is asked for `/tcp` — matching the route segment exactly.
 */
export function generateStaticParams() {
  return PROTOCOL_ORDER.map((id) => ({ id }));
}

/** Any id outside the registry is a 404 rather than a blank page. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  if (!isProtocolId(id)) {
    return { title: "Protocol not found" };
  }

  const protocol = getProtocol(id);
  if (!protocol) {
    return { title: "Protocol not found" };
  }

  return {
    title: `${protocol.name} — ${protocol.longName}`,
    description: `${protocol.subtitle}. ${protocol.hook} An interactive seven-slide presentation covering ${protocol.name}'s layer, purpose, mechanics, ${protocol.frame.unit.toLowerCase()} structure, real-world use and comparisons.`,
    keywords: [
      protocol.name,
      protocol.longName,
      protocol.layer,
      protocol.communication,
      "protocol",
      "networking",
      "interactive",
    ],
    /**
     * Override the layout's canonical. Without this every protocol page
     * inherits `SITE_URL` (`/protocol`) and all seven claim to be the same
     * document, which suppresses six of them from search results.
     *
     * `SITE_URL` is the PUBLIC address (portfolio origin + `/protocol`), which is
     * not derivable from `basePath` — the app is mounted at its own origin's root.
     */
    alternates: {
      canonical: `${SITE_URL}/${id}`,
    },
    openGraph: {
      title: `${protocol.name} — ${protocol.longName}`,
      description: protocol.hook,
      type: "article",
    },
  };
}

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate before anything else, so an invalid id never reaches the shell.
  if (!isProtocolId(id)) {
    notFound();
  }

  const protocol = getProtocol(id);
  if (!protocol) {
    notFound();
  }

  return <ProtocolPresentation protocol={protocol} />;
}
