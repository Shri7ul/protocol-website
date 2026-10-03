"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { ACCENTS } from "@/data/accents";
import { layerStack } from "@/data/foundations";

/**
 * LayerDiagram — the encapsulated stack.
 *
 * The single most important idea on the site: HTTP does not talk to the
 * network, it talks to TCP; TCP does not address machines, it asks IP. Each
 * layer solves one problem and delegates the rest downward.
 *
 * Selecting a layer expands it to reveal the question it answers and what it
 * carries. The embedded buses are shown separately and deliberately, because
 * they are NOT part of this stack.
 */
export function LayerDiagram() {
  const [open, setOpen] = useState<string | null>("transport");
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
      {/* ------------------------- the stack ------------------------- */}
      <div className="flex flex-col gap-2.5">
        {layerStack.map((layer, i) => {
          const isOpen = open === layer.id;
          const accents = layer.protocolIds.map((id) => ACCENTS[id as keyof typeof ACCENTS]);

          return (
            <motion.div
              key={layer.id}
              initial={reduce ? false : { opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.07 }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : layer.id)}
                aria-expanded={isOpen}
                className="w-full rounded-xl text-left transition-colors duration-300"
                style={{
                  backgroundColor: isOpen
                    ? "oklch(0.215 0.011 265 / 0.9)"
                    : "oklch(0.178 0.010 265 / 0.55)",
                  border: `1px solid ${
                    isOpen && accents[0] ? `${accents[0].hex}55` : "var(--color-line)"
                  }`,
                }}
              >
                <div className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                  {/* Depth marker: the stack is drawn with a slight staircase
                      so nesting reads visually. */}
                  <span
                    className="hidden shrink-0 font-mono text-[10px] tabular-nums text-ink-faint sm:block"
                    style={{ width: `${i * 10 + 8}px` }}
                  >
                    L{i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[15px] font-medium text-ink">
                        {layer.label}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                        {layer.carries}
                      </span>
                    </div>
                  </div>

                  {/* Accent pills for the protocols that live here. */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {accents.map((a) => (
                      <span
                        key={a.hex}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: a.hex }}
                      />
                    ))}
                    <svg
                      viewBox="0 0 12 12"
                      className="ml-1.5 h-3 w-3 text-ink-faint transition-transform duration-300"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 4.5L6 8l3.5-3.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-line/70 px-4 py-3.5 sm:px-5">
                      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                        {layer.question}
                      </p>
                      <p className="text-[13.5px] leading-relaxed text-ink-soft">
                        {layer.carriesNote}
                      </p>
                      {layer.protocolIds.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {layer.protocolIds.map((id) => (
                            <a
                              key={id}
                              href={`/protocol/${id}`}
                              className="rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
                              style={{
                                borderColor: `${ACCENTS[id as keyof typeof ACCENTS].hex}55`,
                                color: ACCENTS[id as keyof typeof ACCENTS].hex,
                              }}
                            >
                              Open {id.toUpperCase()} →
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </button>

              {/* Downward arrow between layers. */}
              {i < layerStack.length - 1 ? (
                <div className="flex justify-center py-0.5" aria-hidden="true">
                  <div className="flex flex-col items-center">
                    <span className="h-3 w-px bg-line-strong" />
                    <svg viewBox="0 0 8 6" className="h-1.5 w-2 text-line-strong">
                      <path d="M0 0l4 5 4-5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </div>
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      {/* --------------------- the embedded buses --------------------- */}
      <div className="lg:pt-1">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px w-6 bg-can" />
          <span className="atlas-label atlas-label-strong">
            Outside the stack entirely
          </span>
        </div>

        <p className="mb-5 text-[13.5px] leading-relaxed text-ink-soft">
          I²C and CAN are not in the diagram above, and they never appear in it.
          They are board-level and vehicle-level buses: they connect chips that
          sit centimetres or metres apart, on the same piece of equipment. There
          is no IP address, no port, no router and no DNS involved. Confusing
          them with the networking stack is the single most common mistake when
          first learning either world.
        </p>

        <div className="flex flex-col gap-3">
          <EmbeddedPath
            title="I²C"
            accentHex="#4fc4dd"
            accentSoft="#4fc4dd1f"
            chain={["Controller", "SDA / SCL", "Sensor", "OLED"]}
            note="Two wires, one board, up to 112 addressed targets. Pin-efficient and slow."
            href="/protocol/i2c"
          />
          <EmbeddedPath
            title="CAN"
            accentHex="#e8674a"
            accentSoft="#e8674a1f"
            chain={["Controller", "CAN_H / CAN_L", "Motor", "Battery"]}
            note="Two differential wires, metres of cable, every node equal. Built for noise and for determinism."
            href="/protocol/can"
          />
        </div>

        <div className="mt-6 rounded-xl border border-line bg-surface/50 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            The distinction, in one line
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            The stack above moves data <em className="not-italic text-ink">between computers</em>.
            I²C and CAN move data <em className="not-italic text-ink">inside one machine</em>.
            Different physical distances, different electrical environments,
            different problems — and therefore different protocols.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmbeddedPath({
  title,
  accentHex,
  accentSoft,
  chain,
  note,
  href,
}: {
  title: string;
  accentHex: string;
  accentSoft: string;
  chain: string[];
  note: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group relative block overflow-hidden rounded-xl p-4 transition-colors duration-300"
      style={{
        backgroundColor: "oklch(0.178 0.010 265 / 0.6)",
        border: `1px solid ${accentHex}35`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-mono text-[13px] font-medium tracking-wide"
          style={{ color: accentHex }}
        >
          {title}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors group-hover:text-ink-soft">
          Explore →
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {chain.map((step, i) => (
          <span key={step} className="flex items-center gap-1.5">
            <span
              className="rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide"
              style={{
                borderColor: `${accentHex}40`,
                backgroundColor: accentSoft,
                color: "var(--color-ink-soft)",
              }}
            >
              {step}
            </span>
            {i < chain.length - 1 ? (
              <span className="text-ink-faint" aria-hidden="true">
                →
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-mute">{note}</p>
    </a>
  );
}
