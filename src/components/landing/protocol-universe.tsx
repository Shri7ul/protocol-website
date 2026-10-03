"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { ProtocolOrbit } from "@/components/landing/protocol-orbit";
import { protocols } from "@/data/registry";
import { RISE_REDUCED, rise } from "@/lib/motion";

/**
 * Protocol Universe — the orbit plus a compact index beneath it.
 *
 * The orbit is the showpiece, but it is a poor way to compare protocols or to
 * reach one on a small screen. The list below duplicates it in a linear,
 * scannable form, which is also what the mobile layout falls back to.
 */
export function ProtocolUniverse() {
  const reduce = useReducedMotion();

  return (
    <div>
      <ProtocolOrbit />

      {/* Linear index. Present at every breakpoint, because it is genuinely
          faster to scan than six circular nodes. */}
      <div className="mt-14 border-t border-line pt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span className="atlas-label atlas-label-strong">
            Or browse the six directly
          </span>
          <span className="atlas-label">
            Each opens a seven-slide presentation
          </span>
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {protocols.map((p, i) => (
            <motion.li
              key={p.id}
              {...(reduce ? RISE_REDUCED : rise(14, i * 0.05))}
            >
              <Link
                href={`/${p.id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  backgroundColor: "oklch(0.178 0.010 265 / 0.55)",
                  border: "1px solid var(--color-line)",
                }}
              >
                {/* Accent bar: the protocol's identity, revealed on hover. */}
                <span
                  className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 transition-transform duration-400 group-hover:scale-x-100"
                  style={{ backgroundColor: p.accent.hex }}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono text-[15px] font-medium tracking-tight"
                        style={{ color: p.accent.hex }}
                      >
                        {p.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-mute">
                      {p.longName}
                    </p>
                  </div>

                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: p.accent.hex,
                      boxShadow: `0 0 0 3px ${p.accent.soft}`,
                    }}
                  />
                </div>

                <p className="mt-3 flex-1 text-[12.5px] leading-relaxed text-ink-soft">
                  {p.subtitle}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                  <span className="atlas-label">{p.layer}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors group-hover:text-ink-soft">
                    Open →
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
