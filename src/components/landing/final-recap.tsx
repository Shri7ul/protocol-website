"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";


import { Label } from "@/components/ui/primitives";
import { protocols } from "@/data/registry";
import { RISE_REDUCED, SLIDE_REDUCED, rise, slideIn } from "@/lib/motion";

/**
 * FinalRecap — "You now know how data moves."
 *
 * Closes the story by showing the complete picture once more: the full stack
 * on one side, the embedded buses on the other, and the two lists of things
 * the reader should now be able to answer. This is the last thing on the page,
 * so it carries the CTA back to the start.
 */

const LEARNED = [
  "What a protocol actually is — an agreement about format, order and failure.",
  "Why different protocols exist: distance, noise, reliability and deadline.",
  "How an IP address and a port combine into an endpoint.",
  "How TCP and UDP differ, and which cost each one is choosing to pay.",
  "How HTTP and HTTPS ride on the transport layer, and what TLS adds.",
  "Where DNS fits before a single connection can be opened.",
  "How I²C shares two wires between a dozen chips on one board.",
  "How CAN arbitrates between controllers without losing a single frame.",
  "How a segment, a packet, a datagram and a frame differ — and why.",
  "When each protocol is the right tool, and when it is the wrong one.",
];

export function FinalRecap() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-t border-line">
      <div className="atlas-grid pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.2) 50%, transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <motion.div {...(reduce ? RISE_REDUCED : rise(20, 0))}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-ink-mute">13</span>
            <span className="h-px w-6 bg-line-strong" />
            <Label strong>What you learned</Label>
          </div>

          <h2 className="atlas-display mt-6 max-w-4xl text-[clamp(2.2rem,6vw,4.4rem)] font-medium text-ink">
            You now know how data moves.
          </h2>
        </motion.div>

        {/* ------------------- the complete picture ------------------- */}
        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          {/* The stack, top to bottom. */}
          <motion.div
            {...(reduce ? SLIDE_REDUCED : slideIn(-16, 0.08))}
            className="atlas-panel rounded-xl p-5 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <Label strong>Between computers</Label>
              <Label>TCP/IP stack</Label>
            </div>

            <ol className="flex flex-col gap-1.5">
              {[
                { label: "Application", carries: "HTTP · HTTPS", hex: "#e9a13f" },
                { label: "Transport", carries: "TCP · UDP", hex: "#4f93f5" },
                { label: "Network", carries: "IP", hex: "#8b8f98" },
                { label: "Data Link", carries: "Ethernet · Wi-Fi", hex: "#8b8f98" },
                { label: "Physical", carries: "Copper · Radio", hex: "#8b8f98" },
              ].map((row, i, arr) => (
                <li key={row.label} className="relative">
                  <div
                    className="flex items-center justify-between gap-4 rounded-lg px-3.5 py-2.5"
                    style={{
                      backgroundColor: `${row.hex}0d`,
                      border: `1px solid ${row.hex}28`,
                    }}
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                      {row.label}
                    </span>
                    <span
                      className="font-mono text-[11px] tracking-wide"
                      style={{ color: row.hex }}
                    >
                      {row.carries}
                    </span>
                  </div>
                  {i < arr.length - 1 ? (
                    <div className="flex justify-center py-0.5" aria-hidden="true">
                      <span className="text-[9px] text-ink-faint">↓</span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <p className="mt-5 border-t border-line/60 pt-4 text-[12.5px] leading-relaxed text-ink-mute">
              One request travels down this stack, across the network, and back
              up the other side. Each layer solves one problem and trusts the
              layer below for everything else.
            </p>
          </motion.div>

          {/* The embedded buses, side by side. */}
          <motion.div
            {...(reduce ? SLIDE_REDUCED : slideIn(16, 0.16))}
            className="atlas-panel rounded-xl p-5 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <Label strong>Inside one machine</Label>
              <Label>Board &amp; vehicle buses</Label>
            </div>

            <div className="flex flex-col gap-3">
              {[
                {
                  name: "I²C",
                  hex: "#4fc4dd",
                  chain: ["Main controller", "SDA / SCL", "IMU", "OLED"],
                  note: "Two wires, one board. Pin-efficient, addressable, slow.",
                },
                {
                  name: "CAN",
                  hex: "#e8674a",
                  chain: ["Main controller", "CAN_H / CAN_L", "Motor", "Battery"],
                  note: "Two differential wires, metres of cable. Priority and error containment.",
                },
              ].map((bus) => (
                <div
                  key={bus.name}
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: `${bus.hex}0d`,
                    border: `1px solid ${bus.hex}30`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[13px] font-medium"
                      style={{ color: bus.hex }}
                    >
                      {bus.name}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                    {bus.chain.map((step, i) => (
                      <span key={step} className="flex items-center gap-1.5">
                        <span className="font-mono text-[10.5px] text-ink-soft">
                          {step}
                        </span>
                        {i < bus.chain.length - 1 ? (
                          <span className="text-[9px] text-ink-faint" aria-hidden="true">
                            →
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">
                    {bus.note}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-5 border-t border-line/60 pt-4 text-[12.5px] leading-relaxed text-ink-mute">
              Different distance, different electrical environment, different
              problem — and therefore a completely different protocol.
            </p>
          </motion.div>
        </div>

        {/* ------------------- the ten answers ------------------- */}
        <div className="mt-14">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px w-6 bg-line-strong" />
            <Label strong>Ten things you can now answer</Label>
          </div>

          <ol className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
            {LEARNED.map((item, i) => (
              <motion.li
                key={item}
                {...(reduce ? RISE_REDUCED : rise(10, i * 0.035))}
                className="flex items-baseline gap-3.5 border-b border-line/60 py-3.5"
              >
                <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] leading-relaxed text-ink-soft">
                  {item}
                </span>
              </motion.li>
            ))}
          </ol>
        </div>

        {/* ------------------- the CTA ------------------- */}
        <motion.div
          {...(reduce ? RISE_REDUCED : rise(16, 0))}
          className="mt-16 flex flex-col gap-6 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-[15px] font-medium text-ink">
              Every protocol is one chapter of the same story.
            </p>
            <p className="mt-1.5 text-[13px] text-ink-mute">
              Pick one and follow it from the problem it solves to the bytes on
              the wire.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#universe"
              className="atlas-sheen group inline-flex items-center gap-2.5 rounded-lg bg-ink px-5 py-3 text-[13px] font-medium text-void transition-transform duration-200 hover:scale-[1.015] active:scale-[0.99]"
            >
              Start the journey again
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              >
                <path
                  d="M2 8h11M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </motion.div>

        {/* Quick links to all six, in accent order. */}
        <div className="mt-10 flex flex-wrap gap-2">
          {protocols.map((p) => (
            <Link
              key={p.id}
              href={`/${p.id}`}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors"
              style={{
                borderColor: `${p.accent.hex}40`,
                color: p.accent.hex,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: p.accent.hex }}
              />
              {p.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
