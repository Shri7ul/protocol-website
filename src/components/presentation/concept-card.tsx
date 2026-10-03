"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import type { Concept, GlyphId } from "@/data/types";

/**
 * ConceptCard — a single mechanism, with a purpose-drawn glyph.
 *
 * Each glyph is a tiny abstract diagram rather than an icon: the point is to
 * make the mechanism visible, not to decorate the card. They are deliberately
 * monochrome strokes tinted by the protocol accent, so twelve cards in a grid
 * stay calm rather than turning into a rainbow.
 */
export function ConceptCard({
  concept,
  accentHex,
  index = 0,
}: {
  concept: Concept;
  accentHex: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.05 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
      className="group relative flex flex-col rounded-xl p-4 transition-colors duration-300"
      style={{
        backgroundColor: hovered
          ? "oklch(0.215 0.011 265 / 0.8)"
          : "oklch(0.178 0.010 265 / 0.55)",
        border: `1px solid ${hovered ? `${accentHex}40` : "var(--color-line)"}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <Glyph id={concept.glyph} accentHex={accentHex} active={hovered} />
        {concept.tag ? (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
            style={{
              backgroundColor: `${accentHex}14`,
              color: accentHex,
              border: `1px solid ${accentHex}30`,
            }}
          >
            {concept.tag}
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-[14px] font-medium leading-snug text-ink">
        {concept.title}
      </h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute">
        {concept.body}
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Glyphs
 *
 * Small abstract diagrams, drawn on a 48×48 grid. Each one illustrates the
 * mechanism it is attached to rather than standing in for it decoratively.
 * ------------------------------------------------------------------ */

function Glyph({
  id,
  accentHex,
  active,
}: {
  id?: GlyphId;
  accentHex: string;
  active: boolean;
}) {
  const stroke = active ? accentHex : "var(--color-ink-faint)";

  return (
    <svg
      viewBox="0 0 48 48"
      className="h-9 w-9 shrink-0"
      fill="none"
      aria-hidden="true"
      style={{ transition: "color 300ms" }}
    >
      {renderGlyph(id, stroke, accentHex)}
    </svg>
  );
}

function renderGlyph(
  id: GlyphId | undefined,
  stroke: string,
  accent: string,
): React.ReactNode {
  switch (id) {
    // Three boxes arriving out of order, then re-ordered.
    case "ordering":
      return (
        <>
          <rect x="4" y="8" width="10" height="8" rx="2" stroke={stroke} strokeWidth="1.4" />
          <rect x="19" y="8" width="10" height="8" rx="2" stroke={stroke} strokeWidth="1.4" />
          <rect x="34" y="8" width="10" height="8" rx="2" stroke={stroke} strokeWidth="1.4" />
          <path d="M9 24v8M24 32v-8M39 24v8" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" />
          <rect x="4" y="32" width="10" height="8" rx="2" stroke={accent} strokeWidth="1.6" />
          <rect x="19" y="32" width="10" height="8" rx="2" stroke={accent} strokeWidth="1.6" />
          <rect x="34" y="32" width="10" height="8" rx="2" stroke={accent} strokeWidth="1.6" />
        </>
      );

    // An arrow returning to its origin — the acknowledgement loop.
    case "ack":
      return (
        <>
          <path d="M6 16h30" stroke={stroke} strokeWidth="1.4" />
          <path d="M30 11l6 5-6 5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M42 32H12" stroke={accent} strokeWidth="1.6" />
          <path d="M18 27l-6 5 6 5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // A lost packet, then a second attempt that lands.
    case "retransmit":
      return (
        <>
          <path d="M4 14h20" stroke={stroke} strokeWidth="1.4" />
          <circle cx="30" cy="14" r="3.5" stroke={stroke} strokeWidth="1.4" strokeDasharray="2 2" />
          <path d="M36 14h8" stroke={stroke} strokeWidth="1.4" strokeDasharray="2 3" />
          <path d="M4 32h36" stroke={accent} strokeWidth="1.6" />
          <path d="M34 27l6 5-6 5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // A window gate that opens and closes.
    case "flow":
      return (
        <>
          <path d="M4 12h40M4 36h40" stroke={stroke} strokeWidth="1.4" />
          <rect x="14" y="12" width="4" height="24" rx="1" fill={accent} opacity="0.35" />
          <rect x="30" y="12" width="4" height="24" rx="1" fill={accent} opacity="0.35" />
          <path d="M8 24h6M34 24h6" stroke={accent} strokeWidth="1.6" />
          <path d="M22 24h4" stroke={stroke} strokeWidth="1.4" strokeDasharray="1 3" />
        </>
      );

    // The sawtooth of AIMD.
    case "congestion":
      return (
        <>
          <path d="M4 40h40" stroke={stroke} strokeWidth="1.2" />
          <path d="M4 40l6-8 6-10 4 4 5-8 5-6 4 14 5-6 5-4" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // A block whose final bit is verified.
    case "checksum":
      return (
        <>
          <rect x="6" y="14" width="36" height="20" rx="3" stroke={stroke} strokeWidth="1.4" />
          <path d="M11 24h8M23 24h5" stroke={stroke} strokeWidth="1.2" strokeDasharray="1 3" />
          <circle cx="36" cy="24" r="4.5" stroke={accent} strokeWidth="1.6" />
          <path d="M34 24l1.7 1.8L38.5 22" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // Three arrows converging — the three-way handshake.
    case "handshake":
      return (
        <>
          <path d="M4 12h34" stroke={stroke} strokeWidth="1.4" />
          <path d="M32 7l6 5-6 5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M44 24H10" stroke={stroke} strokeWidth="1.4" />
          <path d="M16 19l-6 5 6 5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 36h34" stroke={accent} strokeWidth="1.6" />
          <path d="M32 31l6 5-6 5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // No handshake at all — data leaves immediately.
    case "stateless":
      return (
        <>
          <rect x="4" y="14" width="12" height="12" rx="2" stroke={accent} strokeWidth="1.6" />
          <path d="M20 20h20" stroke={accent} strokeWidth="1.6" />
          <path d="M34 15l6 5-6 5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 34h40" stroke={stroke} strokeWidth="1.2" strokeDasharray="3 4" />
        </>
      );

    // A gap in a stream where data went missing.
    case "loss":
      return (
        <>
          <path d="M4 20h12" stroke={stroke} strokeWidth="1.4" />
          <path d="M20 20h4" stroke={accent} strokeWidth="1.6" strokeDasharray="2 3" />
          <path d="M28 20h16" stroke={stroke} strokeWidth="1.4" />
          <path d="M18 30l4-14M22 30l4-14" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
        </>
      );

    // Plaintext in, ciphertext out.
    case "encrypt":
      return (
        <>
          <path d="M4 16h10M4 24h10M4 32h10" stroke={stroke} strokeWidth="1.3" />
          <path d="M18 24h8" stroke={stroke} strokeWidth="1.4" />
          <path d="M24 19l6 5-6 5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M34 16h10M34 24h10M34 32h10" stroke={accent} strokeWidth="1.6" strokeDasharray="2 2" />
        </>
      );

    // A certificate: document plus seal.
    case "identity":
      return (
        <>
          <rect x="10" y="6" width="24" height="30" rx="3" stroke={stroke} strokeWidth="1.4" />
          <path d="M16 14h12M16 20h12M16 26h7" stroke={stroke} strokeWidth="1.2" />
          <circle cx="34" cy="34" r="6" fill="var(--color-void)" stroke={accent} strokeWidth="1.6" />
          <path d="M32 34l1.6 1.7L36.5 32" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // A shield with a verified edge.
    case "integrity":
      return (
        <>
          <path d="M24 5l14 5v13c0 9-6 15-14 20-8-5-14-11-14-20V10z" stroke={stroke} strokeWidth="1.4" fill="none" />
          <path d="M17 24l5 5 9-10" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // A clock line with data sampled on its edges.
    case "clock":
      return (
        <>
          <path d="M4 14h6v8h8v-8h8v8h8v-8h10" stroke={accent} strokeWidth="1.6" />
          <path d="M4 34h40" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" />
          <circle cx="10" cy="34" r="2" fill={accent} />
          <circle cx="26" cy="34" r="2" fill={accent} />
          <circle cx="42" cy="34" r="2" fill={accent} />
        </>
      );

    // Two nodes pulling the same line; one wins.
    case "arbitration":
      return (
        <>
          <path d="M4 18h14M4 30h14" stroke={stroke} strokeWidth="1.4" />
          <path d="M30 18h14" stroke={stroke} strokeWidth="1.4" strokeDasharray="2 3" />
          <path d="M30 30h14" stroke={accent} strokeWidth="1.8" />
          <path d="M22 24h4" stroke={accent} strokeWidth="1.6" />
          <circle cx="16" cy="18" r="2.5" fill={stroke} opacity="0.5" />
          <circle cx="16" cy="30" r="2.5" fill={accent} />
        </>
      );

    // Two wires mirrored — differential signalling.
    case "differential":
      return (
        <>
          <path d="M4 18c6 0 6-8 12-8s6 8 12 8 6-8 12-8" stroke={accent} strokeWidth="1.6" />
          <path d="M4 30c6 0 6 8 12 8s6-8 12-8 6 8 12 8" stroke={stroke} strokeWidth="1.4" />
          <path d="M4 24h40" stroke={stroke} strokeWidth="1" strokeDasharray="2 4" />
        </>
      );

    // A queue where the higher-priority item jumps forward.
    case "priority":
      return (
        <>
          <path d="M8 12h32M8 20h32M8 36h32" stroke={stroke} strokeWidth="1.3" />
          <rect x="30" y="30" width="10" height="6" rx="1.5" stroke={accent} strokeWidth="1.6" />
          <path d="M25 33h3" stroke={accent} strokeWidth="1.6" markerEnd="" />
          <path d="M14 33h8" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" />
        </>
      );

    // Many devices on one pair of wires.
    case "multidrop":
      return (
        <>
          <path d="M6 16h36M6 32h36" stroke={stroke} strokeWidth="1.3" />
          {[10, 20, 30, 40].map((x) => (
            <g key={x}>
              <path d={`M${x} 16v6M${x} 26v6`} stroke={stroke} strokeWidth="1.2" />
              <circle cx={x} cy="24" r="2.5" stroke={accent} strokeWidth="1.4" fill="none" />
            </g>
          ))}
        </>
      );

    // A resistor holding a line high.
    case "pullup":
      return (
        <>
          <path d="M24 6v6" stroke={stroke} strokeWidth="1.4" />
          <rect x="19" y="12" width="10" height="14" rx="2" stroke={accent} strokeWidth="1.6" />
          <path d="M24 26v16" stroke={stroke} strokeWidth="1.4" />
          <path d="M4 42h40" stroke={stroke} strokeWidth="1.6" />
          <path d="M38 12v-6M38 12h6" stroke={stroke} strokeWidth="1.3" />
          <path d="M4 12h8" stroke={accent} strokeWidth="1.4" strokeDasharray="2 3" />
        </>
      );

    // A stack of cached layers with the freshest on top.
    case "cache":
      return (
        <>
          <rect x="8" y="8" width="32" height="9" rx="2" stroke={accent} strokeWidth="1.6" />
          <rect x="8" y="21" width="32" height="9" rx="2" stroke={stroke} strokeWidth="1.3" />
          <rect x="8" y="34" width="32" height="9" rx="2" stroke={stroke} strokeWidth="1.3" opacity="0.55" />
        </>
      );

    // A verb applied to a resource.
    case "method":
      return (
        <>
          <rect x="6" y="8" width="14" height="10" rx="2" stroke={accent} strokeWidth="1.6" />
          <path d="M24 13h14" stroke={stroke} strokeWidth="1.4" />
          <rect x="6" y="24" width="18" height="10" rx="2" stroke={stroke} strokeWidth="1.3" />
          <path d="M28 29h10" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" />
          <path d="M40 13l4 0-3 3" stroke={accent} strokeWidth="1.3" opacity="0" />
        </>
      );

    // A token carried between two parties.
    case "session":
      return (
        <>
          <circle cx="12" cy="24" r="6" stroke={stroke} strokeWidth="1.4" />
          <circle cx="38" cy="24" r="6" stroke={stroke} strokeWidth="1.4" />
          <path d="M19 24h10" stroke={accent} strokeWidth="1.6" />
          <path d="M27 20l4 4-4 4" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="22" y="30" width="8" height="7" rx="1.5" stroke={accent} strokeWidth="1.4" />
        </>
      );

    default:
      return <circle cx="24" cy="24" r="10" stroke={stroke} strokeWidth="1.4" strokeDasharray="3 3" />;
  }
}
