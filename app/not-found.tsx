import Link from "next/link";

import { protocols } from "@/data/registry";

/**
 * Not-found page.
 *
 * Reached by an invalid `/<id>` — anything outside the six defined ids, since
 * `dynamicParams = false` turns unknown params into a 404. It shows the valid
 * set rather than a dead end.
 *
 * Publicly this is served for e.g. `https://shriful.tech/protocol/bogus`: the
 * Worker strips the prefix, the origin sees `/bogus`, no route or param
 * matches, and Next returns this document with a 404 status.
 */
export default function NotFound() {
  return (
    <div className="atlas-grid relative flex min-h-dvh items-center justify-center px-5 py-24">
      <div className="relative w-full max-w-xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          Error 404
        </p>

        <h1 className="atlas-display mt-4 text-[clamp(2rem,6vw,3.4rem)] font-medium text-ink">
          No such protocol
        </h1>

        <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-ink-soft">
          That address does not correspond to a protocol in the atlas. There are
          six, and their identifiers are literal.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {protocols.map((p) => (
            <Link
              key={p.id}
              href={`/${p.id}`}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors"
              style={{ borderColor: `${p.accent.hex}45`, color: p.accent.hex }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: p.accent.hex }}
              />
              {p.id}
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg bg-ink px-5 py-3 text-[13px] font-medium text-void transition-transform hover:scale-[1.02]"
          >
            Back to the atlas
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M2 8h11M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
