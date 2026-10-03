"use client";

import { motion, useReducedMotion } from "framer-motion";

import { ENTER_REDUCED, enter } from "@/lib/motion";

/**
 * Hero.
 *
 * The claim is "HOW DOES DATA ACTUALLY MOVE?" and the visual answers it
 * immediately: the same information shown twice — as an abstract layer stack,
 * and as the concrete protocols that implement each layer. Seeing those two
 * side by side is the whole thesis of the site.
 */
export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden pb-16 pt-28 sm:pb-24 sm:pt-36">
      <div className="atlas-grid pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.16) 50%, transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
        {/* Eyebrow */}
        <motion.div
          {...(reduce ? ENTER_REDUCED : enter(12, 0, 0.6))}
          className="mb-8 flex flex-wrap items-center gap-3"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-https opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-https" />
            </span>
            <span className="atlas-label atlas-label-strong">
              Interactive guide · 6 protocols
            </span>
          </span>
          <span className="atlas-label hidden sm:inline">
            Networking &amp; embedded systems
          </span>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
          {/* ------------------ headline column ------------------ */}
          <div>
            <motion.h1
              {...(reduce ? ENTER_REDUCED : enter(20, 0.05, 0.75))}
              className="atlas-display text-[clamp(2.6rem,7.4vw,5.4rem)] font-medium text-ink"
            >
              How does data
              <br />
              <span className="relative inline-block">
                actually move?
                {/* Animated underline: a signal travelling along a wire. */}
                <svg
                  className="absolute -bottom-1 left-0 h-3 w-full overflow-visible"
                  viewBox="0 0 400 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    y1="6"
                    x2="400"
                    y2="6"
                    stroke="var(--color-line-strong)"
                    strokeWidth="1"
                  />
                  <motion.line
                    x1="0"
                    y1="6"
                    x2="400"
                    y2="6"
                    stroke="var(--color-ink)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="60 340"
                    animate={reduce ? undefined : { strokeDashoffset: [0, -400] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: "linear" }}
                  />
                </svg>
              </span>
            </motion.h1>

            <motion.p
              {...(reduce ? ENTER_REDUCED : enter(16, 0.16, 0.7))}
              className="mt-7 max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-base"
            >
              Explore the protocols, addressing systems, and communication
              mechanisms that make modern networks and embedded systems work —
              from the three-way handshake that opens a web connection to the
              two wires that drive a robot&rsquo;s motors.
            </motion.p>

            <motion.div
              {...(reduce ? ENTER_REDUCED : enter(16, 0.24, 0.7))}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <a
                href="#universe"
                className="atlas-sheen group inline-flex items-center gap-2.5 rounded-lg bg-ink px-5 py-3 text-[13px] font-medium text-void transition-transform duration-200 hover:scale-[1.015] active:scale-[0.99]"
              >
                Explore protocols
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
              <a
                href="#trace"
                className="inline-flex items-center gap-2.5 rounded-lg border border-line px-5 py-3 text-[13px] font-medium text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink"
              >
                Trace a real request
                <span className="atlas-label">live</span>
              </a>
            </motion.div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
                { k: "Protocols", v: "06" },
                { k: "Slides each", v: "07" },
                { k: "Layers", v: "04 + 2" },
              ].map((s) => (
                <div key={s.k} className="bg-void/70 px-4 py-3.5">
                  <dt className="atlas-label">{s.k}</dt>
                  <dd className="mt-1.5 font-mono text-xl tabular-nums text-ink">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ------------------ the two flows ------------------ */}
          <motion.div
            {...(reduce ? ENTER_REDUCED : enter(24, 0.3, 0.8))}
            className="flex flex-col gap-4"
          >
            <LayerFlow />
            <EmbeddedFlow />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The abstract stack on the left, the concrete protocols on the right, with a
 * connector between them. This pairing is the point of the whole hero.
 */
function LayerFlow() {
  const rows = [
    { layer: "Application", protocols: ["HTTP", "HTTPS"], accent: "http" as const },
    { layer: "Transport", protocols: ["TCP", "UDP"], accent: "tcp" as const },
    { layer: "Network", protocols: ["IP"], accent: "neutral" as const },
    { layer: "Data Link", protocols: ["Ethernet", "Wi-Fi"], accent: "neutral" as const },
    { layer: "Physical", protocols: ["Copper", "Radio"], accent: "neutral" as const },
  ];

  const colors: Record<string, string> = {
    http: "#e9a13f",
    tcp: "#4f93f5",
    neutral: "#8b8f98",
  };

  return (
    <div className="atlas-panel rounded-xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="atlas-label atlas-label-strong">
          One request, five layers
        </span>
        <span className="atlas-label">encapsulation</span>
      </div>

      <ul className="flex flex-col">
        {rows.map((row, i) => (
          <li key={row.layer} className="group/row relative">
            <div className="flex items-center gap-3 py-2">
              {/* Layer name, left aligned in a fixed column. */}
              <span className="w-[86px] shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                {row.layer}
              </span>

              {/* Connector: a dashed line with a travelling dot, so the
                  "downward delegation" is visible rather than implied. */}
              <span className="relative flex h-6 flex-1 items-center">
                <span className="h-px w-full bg-line" />
                <span
                  className="absolute left-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: colors[row.accent] }}
                />
              </span>

              <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {row.protocols.map((p) => (
                  <span
                    key={p}
                    className="rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide"
                    style={{
                      borderColor: `${colors[row.accent]}40`,
                      color:
                        row.accent === "neutral"
                          ? "var(--color-ink-mute)"
                          : colors[row.accent],
                      backgroundColor:
                        row.accent === "neutral" ? "transparent" : `${colors[row.accent]}12`,
                    }}
                  >
                    {p}
                  </span>
                ))}
              </span>
            </div>

            {i < rows.length - 1 ? (
              <div className="flex items-center" aria-hidden="true">
                <span className="w-[86px]" />
                <span className="flex items-center">
                  <span className="ml-[-2.5px] block h-3 w-px bg-line/70" />
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-line/60 pt-3 text-[12px] leading-relaxed text-ink-mute">
        Each layer wraps the one above it. HTTP never touches a wire; it hands
        bytes to TCP, which hands packets to IP, which asks the link layer to
        transmit them.
      </p>
    </div>
  );
}

function EmbeddedFlow() {
  return (
    <div className="atlas-panel rounded-xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="atlas-label atlas-label-strong">
          Separately · inside one machine
        </span>
        <span className="atlas-label">not TCP/IP</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          {
            name: "I²C",
            hex: "#4fc4dd",
            path: ["MCU", "SDA/SCL", "Sensors"],
          },
          {
            name: "CAN",
            hex: "#e8674a",
            path: ["MCU", "CAN_H/L", "Motors"],
          },
        ].map((bus) => (
          <div
            key={bus.name}
            className="rounded-lg border p-3"
            style={{ borderColor: `${bus.hex}30`, backgroundColor: `${bus.hex}0a` }}
          >
            <span
              className="font-mono text-[12px] font-medium"
              style={{ color: bus.hex }}
            >
              {bus.name}
            </span>
            <div className="mt-2.5 flex flex-col gap-1">
              {bus.path.map((p, i) => (
                <div key={p} className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-ink-mute">{p}</span>
                  {i < bus.path.length - 1 ? (
                    <span className="text-[9px] text-ink-faint" aria-hidden="true">
                      ↓
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-line/60 pt-3 text-[12px] leading-relaxed text-ink-mute">
        These connect chips on a board, not computers on a network. No IP
        address, no router, no DNS.
      </p>
    </div>
  );
}
