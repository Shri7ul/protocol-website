"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import type { Comparison } from "@/data/types";

/**
 * ComparisonTable — used on slide 06 of every protocol.
 *
 * Deliberately framed as "when each mechanism is appropriate" rather than
 * better/worse: the framing sentence at the top is required data, and every
 * cell states a trade-off rather than a verdict.
 */
export function ComparisonTable({ comparison }: { comparison: Comparison }) {
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const reduce = useReducedMotion();

  const columns = comparison.columns;

  return (
    <div>
      <p className="mb-6 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">
        {comparison.framing}
      </p>

      <div className="atlas-scroll -mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
        <table
          className="w-full border-separate border-spacing-0 text-left"
          style={{ minWidth: columns.length > 2 ? 760 : 520 }}
        >
          <caption className="sr-only">{comparison.title}</caption>

          <thead>
            <tr>
              <th scope="col" className="pb-3 pr-5 align-bottom" style={{ minWidth: 130 }}>
                <span className="atlas-label">Dimension</span>
              </th>
              {columns.map((col) => (
                <th
                  key={col.label}
                  scope="col"
                  className="pb-3 pl-3 pr-4 align-bottom"
                  style={{ minWidth: 180 }}
                >
                  <span className="flex items-center gap-2">
                    {col.accentHex ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: col.accentHex }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className="font-mono text-[13px] font-medium tracking-wide"
                      style={{ color: col.accentHex ?? "var(--color-ink)" }}
                    >
                      {col.label}
                    </span>
                    {col.emphasis ? (
                      <span
                        className="ml-1 rounded-full px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em]"
                        style={{
                          backgroundColor: `${col.accentHex}18`,
                          color: col.accentHex,
                          border: `1px solid ${col.accentHex}35`,
                        }}
                      >
                        this page
                      </span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {comparison.rows.map((row, r) => {
              const isActive = activeRow === r;
              return (
                <tr
                  key={row.dimension}
                  onMouseEnter={() => setActiveRow(r)}
                  onMouseLeave={() => setActiveRow(null)}
                >
                  <th
                    scope="row"
                    className="border-t border-line pr-5 align-top"
                    style={{
                      backgroundColor: isActive ? "oklch(0.178 0.010 265 / 0.6)" : undefined,
                      transition: "background-color 200ms",
                    }}
                  >
                    <span className="block py-3.5">
                      <span
                        className="text-[12.5px] font-medium leading-snug transition-colors"
                        style={{
                          color: isActive ? "var(--color-ink)" : "var(--color-ink-soft)",
                        }}
                      >
                        {row.dimension}
                      </span>
                    </span>
                  </th>

                  {row.cells.map((cell, c) => {
                    const col = columns[c];
                    return (
                      <td
                        key={`${row.dimension}-${c}`}
                        className="border-t border-line py-3.5 pl-3 pr-4 align-top"
                        style={{
                          backgroundColor: isActive
                            ? `${col?.accentHex ?? "#ffffff"}08`
                            : undefined,
                          transition: "background-color 200ms",
                        }}
                      >
                        <span className="block text-[12px] leading-relaxed text-ink-mute">
                          {cell}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-4 text-[11.5px] leading-relaxed text-ink-faint"
      >
        Hover a row to isolate it. No column is better — each mechanism is the
        right answer to a different constraint.
      </motion.p>
    </div>
  );
}
