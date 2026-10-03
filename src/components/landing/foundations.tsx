"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { LayerDiagram } from "@/components/landing/layer-diagram";
import { Section, SectionHeading } from "@/components/shell/section";
import { ACCENTS } from "@/data/accents";
import { foundations } from "@/data/foundations";
import { cn } from "@/lib/utils";

/**
 * Foundations — the vocabulary that is not a protocol.
 *
 * The brief is explicit that IP, port, MAC, packet, frame, router and DNS must
 * not be presented as six more protocols. So this section is deliberately
 * structured differently from every protocol on the page: a grouped glossary
 * with expandable definitions, sitting underneath the layer diagram that shows
 * where each term belongs.
 */

const GROUPS: { id: "address" | "unit" | "device" | "role"; label: string; blurb: string }[] = [
  {
    id: "address",
    label: "Addresses & identifiers",
    blurb: "How data is pointed at the right machine, the right program, and the right hop.",
  },
  {
    id: "unit",
    label: "Units of data",
    blurb: "The name of the data changes at every layer, because each layer wraps the one above.",
  },
  {
    id: "device",
    label: "Devices & roles",
    blurb: "What does the forwarding, and who speaks first.",
  },
  {
    id: "role",
    label: "The word itself",
    blurb: "What a protocol actually is — an agreement, and nothing more.",
  },
];

export function Foundations() {
  const [open, setOpen] = useState<string | null>("IP");
  const reduce = useReducedMotion();

  return (
    <Section id="foundations" className="atlas-grid">
      <SectionHeading
        marker="02"
        label="The networking foundations"
        title="The words that are not protocols"
        lead="Before the six protocols, the vocabulary they all depend on. IP, ports, MAC addresses, packets and DNS are not protocols you choose between — they are the nouns the protocols operate on. Here is what each one is, and which layer it belongs to."
      />

      {/* --------------------- the layer diagram --------------------- */}
      <div className="mb-16">
        <LayerDiagram />
      </div>

      {/* --------------------- the glossary --------------------- */}
      <div className="mb-8 flex items-center gap-3">
        <span className="h-px w-6 bg-line-strong" />
        <span className="atlas-label atlas-label-strong">
          Twelve terms, grouped by the job they do
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
        {GROUPS.map((group, gi) => {
          const terms = foundations.filter((t) => t.group === group.id);
          if (terms.length === 0) return null;

          return (
            <motion.div
              key={group.id}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: reduce ? 0 : gi * 0.06 }}
            >
              <div className="mb-3.5">
                <h3 className="text-[15px] font-medium text-ink">{group.label}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">
                  {group.blurb}
                </p>
              </div>

              <ul className="flex flex-col gap-1.5">
                {terms.map((term) => {
                  const isOpen = open === term.term;
                  return (
                    <li key={term.term}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : term.term)}
                        aria-expanded={isOpen}
                        className={cn(
                          "w-full rounded-lg px-3.5 py-3 text-left transition-colors duration-200",
                          isOpen
                            ? "bg-surface/80"
                            : "bg-surface/35 hover:bg-surface/60",
                        )}
                        style={{
                          border: `1px solid ${
                            isOpen ? "var(--color-line-strong)" : "var(--color-line)"
                          }`,
                        }}
                      >
                        <span className="flex items-baseline gap-3">
                          <span className="font-mono text-[13px] font-medium text-ink">
                            {term.term}
                          </span>
                          <span className="atlas-label">{term.scope}</span>
                          <svg
                            viewBox="0 0 12 12"
                            className="ml-auto h-3 w-3 shrink-0 text-ink-faint transition-transform duration-300"
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
                        </span>

                        <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-soft">
                          {term.definition}
                        </span>

                        {isOpen ? (
                          <motion.span
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="block overflow-hidden"
                          >
                            <span className="mt-2.5 block border-t border-line/70 pt-2.5 text-[12.5px] leading-relaxed text-ink-mute">
                              {term.detail}
                            </span>
                            {term.related && term.related.length > 0 ? (
                              <span className="mt-3 flex flex-wrap gap-1.5">
                                {term.related.map((id) => (
                                  <Link
                                    key={id}
                                    href={`/${id}`}
                                    className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                                    style={{
                                      borderColor: `${ACCENTS[id].hex}45`,
                                      color: ACCENTS[id].hex,
                                    }}
                                  >
                                    {id.toUpperCase()}
                                  </Link>
                                ))}
                              </span>
                            ) : null}
                          </motion.span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* The single most important clarification on the page. */}
      <div className="mt-12 rounded-xl border border-line bg-surface/50 p-5 sm:p-6">
        <p className="atlas-label atlas-label-strong">
          Not six more protocols
        </p>
        <p className="mt-2.5 max-w-3xl text-[14px] leading-relaxed text-ink-soft">
          Every term above is either an <strong className="font-medium text-ink">address</strong>,
          a <strong className="font-medium text-ink">unit of data</strong>, a{" "}
          <strong className="font-medium text-ink">device</strong>, or a{" "}
          <strong className="font-medium text-ink">role</strong>. None of them is a
          protocol you can build on — they are the concepts the protocols
          manipulate. The six protocols start at section 03.
        </p>
      </div>
    </Section>
  );
}
