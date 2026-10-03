"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * ProgressIndicator — `03 / 07` plus clickable dots.
 *
 * The dots are real buttons, not decoration: they are the fastest way to jump
 * to a known slide, and they carry the slide title for screen readers.
 */
export function ProgressIndicator({
  total,
  current,
  accentHex,
  labels,
  onSelect,
  className,
}: {
  total: number;
  current: number;
  accentHex: string;
  labels: string[];
  onSelect: (index: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="font-mono text-[11px] tabular-nums text-ink-soft">
        <span style={{ color: accentHex }}>
          {String(current + 1).padStart(2, "0")}
        </span>
        <span className="text-ink-faint"> / {String(total).padStart(2, "0")}</span>
      </span>

      <ol className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const isCurrent = i === current;
          const isPast = i < current;
          const label = labels[i] ?? `Slide ${i + 1}`;

          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Slide ${i + 1}: ${label}`}
                title={label}
                className="group relative flex h-6 items-center px-0.5"
              >
                {/* Hit area is deliberately larger than the dot. */}
                <motion.span
                  className="block rounded-full"
                  animate={{
                    width: isCurrent ? 22 : 6,
                    height: 6,
                    backgroundColor: isCurrent
                      ? accentHex
                      : isPast
                        ? `${accentHex}80`
                        : "var(--color-line-strong)",
                  }}
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
