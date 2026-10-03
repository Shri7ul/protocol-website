"use client";

import { motion, useReducedMotion } from "framer-motion";

import type { Sequence } from "@/data/types";

/**
 * PacketAnimation — renders a `Sequence` as an animated time-sequence diagram.
 *
 * Two node columns on the left and right, time flowing downward, arrows
 * travelling from one to the other. This is the standard notation for protocol
 * exchanges, and it is the single most useful diagram in the whole subject:
 * a handshake, an acknowledgement, a retransmission and a teardown are all the
 * same shape with different labels.
 *
 * Everything is driven by data — `Sequence` is defined in `src/data/types.ts`
 * and every protocol supplies its own.
 */
export function PacketAnimation({
  sequence,
  accentHex,
  compact = false,
  animate = true,
}: {
  sequence: Sequence;
  accentHex: string;
  compact?: boolean;
  animate?: boolean;
}) {
  const reduce = useReducedMotion();
  const shouldAnimate = animate && !reduce;

  const nodeCount = sequence.nodes.length;
  const arrowCount = sequence.arrows.length;

  // Row height scales with the number of arrows so long sequences stay legible.
  const rowHeight = compact ? 34 : 40;
  const headHeight = 46;
  const height = headHeight + arrowCount * rowHeight + 16;

  // Node x positions, as percentages of the drawing width.
  const nodeX = (i: number) =>
    nodeCount === 1 ? 50 : 14 + (i / (nodeCount - 1)) * 72;

  const toneColour = (tone?: string) => {
    if (tone === "neutral") return "var(--color-ink-mute)";
    if (tone === "ok") return "#4cc98a";
    if (tone === "danger") return "#e8674a";
    if (tone === "warn") return "#e9a13f";
    return accentHex;
  };

  return (
    <div className="w-full overflow-hidden">
      {sequence.caption ? (
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: accentHex }}
          />
          <span className="atlas-label atlas-label-strong">
            {sequence.caption}
          </span>
        </div>
      ) : null}

      <div
        className="relative w-full"
        style={{ height }}
        role="img"
        aria-label={`Sequence diagram: ${sequence.caption ?? "protocol exchange"}. ${sequence.arrows
          .map(
            (a) =>
              `${sequence.nodes[a.from]?.label} to ${sequence.nodes[a.to]?.label}: ${a.label}`,
          )
          .join(". ")}`}
      >
        {/* Lifelines for each node. */}
        {sequence.nodes.map((node, i) => {
          const x = nodeX(i);
          return (
            <div key={node.label + i} className="absolute inset-y-0" style={{ left: `${x}%` }}>
              {/* Node box. */}
              <div className="-translate-x-1/2">
                <div
                  className="flex min-w-[84px] flex-col items-center rounded-md px-2.5 py-1.5 backdrop-blur-sm"
                  style={{
                    backgroundColor: "oklch(0.215 0.011 265 / 0.92)",
                    border: `1px solid ${accentHex}45`,
                  }}
                >
                  <span className="font-mono text-[11px] font-medium text-ink">
                    {node.label}
                  </span>
                  {node.sub ? (
                    <span className="mt-0.5 font-mono text-[9px] text-ink-faint">
                      {node.sub}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Dashed lifeline running the full height. */}
              <span
                className="absolute top-[46px] bottom-0 w-px -translate-x-1/2"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, ${accentHex}55 0 3px, transparent 3px 8px)`,
                }}
                aria-hidden="true"
              />
            </div>
          );
        })}

        {/* Arrows. */}
        {sequence.arrows.map((arrow, i) => {
          const y = headHeight + i * rowHeight + rowHeight / 2;
          const fromX = nodeX(arrow.from);
          const toX = nodeX(arrow.to);
          const left = Math.min(fromX, toX);
          const width = Math.abs(toX - fromX);
          const forward = toX > fromX;
          const colour = toneColour(arrow.tone);

          return (
            <motion.div
              key={`${arrow.label}-${i}`}
              className="absolute flex items-center"
              style={{
                top: y,
                left: `${left}%`,
                width: `${width}%`,
                transform: "translateY(-50%)",
                // Arrows run left-to-right in DOM order regardless of
                // direction, so the head and the label are flipped as needed.
                flexDirection: forward ? "row" : "row-reverse",
              }}
              initial={shouldAnimate ? { opacity: 0, scaleX: 0.35 } : false}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.45,
                delay: shouldAnimate ? i * 0.12 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {/* Origin tick. */}
              <span
                className="h-2 w-px shrink-0"
                style={{ backgroundColor: `${colour}70` }}
                aria-hidden="true"
              />

              {/* The line itself, with an animated travelling dash. */}
              <span className="relative h-px flex-1">
                <span
                  className="absolute inset-0"
                  style={{
                    backgroundColor: `${colour}50`,
                    backgroundImage: arrow.dashed
                      ? `repeating-linear-gradient(to right, ${colour} 0 4px, transparent 4px 9px)`
                      : undefined,
                  }}
                />
                {shouldAnimate ? (
                  <motion.span
                    className="absolute top-1/2 h-[3px] w-6 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: colour }}
                    animate={{
                      left: forward ? ["0%", "100%"] : ["100%", "0%"],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: "easeInOut",
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </span>

              {/* Arrowhead. */}
              <span
                className="flex h-3 w-1.5 shrink-0 items-center justify-center"
                style={{
                  transform: forward ? "scaleX(1)" : "scaleX(-1)",
                }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 6 8" className="h-2.5 w-2" style={{ color: colour }}>
                  <path d="M0 0l6 4-6 4z" fill="currentColor" />
                </svg>
              </span>

              {/* Label, centred above the line. */}
              <span
                className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+3px)] whitespace-nowrap"
                style={{ direction: "ltr" }}
              >
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-[10px] leading-none"
                  style={{
                    backgroundColor: "oklch(0.142 0.009 265 / 0.92)",
                    color: colour,
                    border: `1px solid ${colour}30`,
                  }}
                >
                  {arrow.label}
                </span>
                {arrow.detail ? (
                  <span className="ml-1.5 font-mono text-[9px] text-ink-faint">
                    {arrow.detail}
                  </span>
                ) : null}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
