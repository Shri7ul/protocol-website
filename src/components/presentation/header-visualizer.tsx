"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import type { HeaderField, HeaderRow } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * HeaderVisualizer — the interactive packet / frame structure diagram.
 *
 * Rows of fields laid out horizontally, each sized by its `span` weight and
 * labelled with its real width from the specification. Selecting a field
 * (hover, click, or keyboard focus) opens an inspector showing what it does,
 * why it exists, and an example value from a real packet.
 *
 * The same component renders a TCP segment, a UDP datagram, a TLS record, an
 * I²C transaction and a CAN frame, because all of them are `HeaderRow[]`.
 */

const TONES: Record<string, string> = {
  accent: "#4f93f5",
  neutral: "#8b8f98",
  warn: "#e9a13f",
  ok: "#4cc98a",
  danger: "#e8674a",
};

export function HeaderVisualizer({
  rows,
  unit,
  overhead,
  note,
  accentHex,
}: {
  rows: HeaderRow[];
  unit: string;
  overhead: string;
  note: string;
  accentHex: string;
}) {
  const [selected, setSelected] = useState<{ field: HeaderField; row: number } | null>(
    null,
  );
  const reduce = useReducedMotion();

  const fieldColour = (field: HeaderField) =>
    field.tone === "neutral"
      ? TONES.neutral
      : field.tone
        ? TONES[field.tone]
        : accentHex;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-8">
      {/* -------------------------- the diagram -------------------------- */}
      <div>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink">
            {unit}
          </span>
          <span className="atlas-label">{overhead}</span>
        </div>

        <div className="flex flex-col gap-2">
          {rows.map((row, ri) => (
            <motion.div
              key={row.label ?? `row-${ri}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: reduce ? 0 : ri * 0.06 }}
            >
              {row.label ? (
                <div className="mb-1 flex items-center gap-2">
                  <span className="atlas-label">{row.label}</span>
                  <span className="h-px flex-1 bg-line/60" />
                </div>
              ) : null}

              {/* Fields share the row by flex weight, so the drawing always
                  fills the width while keeping the real relative proportions. */}
              <div className="flex gap-1">
                {row.fields.map((field, fi) => {
                  const colour = fieldColour(field);
                  const isActive =
                    selected?.field.name === field.name && selected.row === ri;
                  const dimmed = selected !== null && !isActive;

                  return (
                    <button
                      key={`${field.name}-${fi}`}
                      type="button"
                      onMouseEnter={() => setSelected({ field, row: ri })}
                      onFocus={() => setSelected({ field, row: ri })}
                      onClick={() => setSelected({ field, row: ri })}
                      aria-pressed={isActive}
                      aria-describedby="header-inspector"
                      className={cn(
                        "group relative min-w-0 rounded-md px-2.5 py-3 text-left transition-all duration-200",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                      )}
                      style={{
                        flexGrow: field.span ?? 1,
                        flexBasis: 0,
                        backgroundColor: isActive
                          ? `${colour}26`
                          : dimmed
                            ? "oklch(0.178 0.010 265 / 0.45)"
                            : `${colour}12`,
                        border: `1px solid ${
                          isActive ? colour : dimmed ? "var(--color-line)" : `${colour}38`
                        }`,
                        boxShadow: isActive ? `0 8px 28px -14px ${colour}` : undefined,
                        opacity: dimmed ? 0.72 : 1,
                      }}
                    >
                      <span className="block truncate font-mono text-[11.5px] font-medium leading-tight text-ink">
                        {field.name}
                      </span>
                      <span
                        className="mt-1 block truncate font-mono text-[9.5px] leading-tight"
                        style={{ color: isActive ? colour : "var(--color-ink-faint)" }}
                      >
                        {field.size}
                      </span>

                      {/* Active marker on the bottom edge. */}
                      <motion.span
                        className="absolute inset-x-1 bottom-0 h-[2px] rounded-full"
                        style={{ backgroundColor: colour }}
                        initial={false}
                        animate={{ opacity: isActive ? 1 : 0, scaleX: isActive ? 1 : 0.3 }}
                        transition={{ duration: 0.22 }}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-5 border-t border-line/60 pt-3.5 text-[12.5px] leading-relaxed text-ink-mute">
          {note}
        </p>
      </div>

      {/* -------------------------- the inspector -------------------------- */}
      <div>
        <div className="sticky top-24">
          <div className="mb-3 flex items-center justify-between">
            <span className="atlas-label atlas-label-strong">Field inspector</span>
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="atlas-label transition-colors hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div
            id="header-inspector"
            className="min-h-[290px] overflow-hidden rounded-xl"
            style={{
              border: `1px solid ${selected ? `${fieldColour(selected.field)}40` : "var(--color-line)"}`,
              backgroundColor: "oklch(0.178 0.010 265 / 0.6)",
            }}
          >
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={`${selected.field.name}-${selected.row}`}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3
                      className="font-mono text-[15px] font-medium leading-tight"
                      style={{ color: fieldColour(selected.field) }}
                    >
                      {selected.field.name}
                    </h3>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px]"
                      style={{
                        backgroundColor: `${fieldColour(selected.field)}1a`,
                        color: fieldColour(selected.field),
                        border: `1px solid ${fieldColour(selected.field)}38`,
                      }}
                    >
                      {selected.field.size}
                    </span>
                  </div>

                  <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                    {selected.field.role}
                  </p>

                  {selected.field.detail ? (
                    <p className="mt-3 border-t border-line/60 pt-3 text-[12.5px] leading-relaxed text-ink-mute">
                      {selected.field.detail}
                    </p>
                  ) : null}

                  {selected.field.example ? (
                    <div className="mt-4 rounded-lg border border-line bg-void/50 px-3 py-2.5">
                      <span className="atlas-label">Example value</span>
                      <p
                        className="mt-1.5 break-all font-mono text-[12.5px]"
                        style={{ color: fieldColour(selected.field) }}
                      >
                        {selected.field.example}
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex min-h-[290px] flex-col items-center justify-center gap-3 p-6 text-center"
                >
                  {/* A quiet glyph so the empty state still looks designed. */}
                  <svg
                    viewBox="0 0 40 40"
                    className="h-9 w-9 text-line-strong"
                    aria-hidden="true"
                    fill="none"
                  >
                    <rect
                      x="6"
                      y="12"
                      width="28"
                      height="6"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="6"
                      y="22"
                      width="18"
                      height="6"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                  <p className="max-w-[220px] text-[12.5px] leading-relaxed text-ink-mute">
                    Select any field to see what it does, how wide it is, and a
                    real value from a live packet.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
