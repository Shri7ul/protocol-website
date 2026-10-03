"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { protocols } from "@/data/registry";
import type { ProtocolDefinition } from "@/data/types";

/**
 * Protocol Orbit — the landing page centrepiece.
 *
 * Six protocol nodes sit on a ring around a central network core, each joined
 * to it by a glowing connection line. Hovering a node highlights it, animates
 * its wire and dims the rest. Keyboard users get the same behaviour through
 * focus, and each node is a real link so it works without JavaScript.
 *
 * Geometry: nodes are positioned with trigonometry on a fixed 1000×1000
 * viewBox and drawn with SVG so the wires and the nodes share one coordinate
 * space and one transform. The SVG scales; the node interiors are HTML drawn
 * in an absolutely-positioned overlay so the cards can use real typography
 * and real hover states rather than SVG text.
 */

const SIZE = 1000;
const CENTER = SIZE / 2;
const RADIUS = 356;
const NODE = 154;

/**
 * A Next.js `<Link>` carrying Framer Motion props.
 *
 * The orbit nodes animate on hover, focus and mount, so they need motion
 * props *and* real client-side navigation. A plain `<a href="/protocol/...">`
 * would give us neither: it hard-codes the deployment's path prefix (which
 * then gets applied a second time by `basePath`) and it forces a full page
 * reload on every click.
 *
 * `motion.create()` is hoisted to module scope on purpose — calling it inside
 * the component would build a new component type on every render and remount
 * the whole subtree.
 */
const MotionLink = motion.create(Link);

interface Placed {
  protocol: ProtocolDefinition;
  angle: number;
  x: number;
  y: number;
}

export function ProtocolOrbit() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const active = hovered ?? focused;

  const placed: Placed[] = useMemo(
    () =>
      protocols.map((protocol, index) => {
        // Start at the top and go clockwise so the order reads naturally.
        const angle = (index / protocols.length) * Math.PI * 2 - Math.PI / 2;
        return {
          protocol,
          angle,
          x: CENTER + Math.cos(angle) * RADIUS,
          y: CENTER + Math.sin(angle) * RADIUS,
        };
      }),
    [],
  );

  const clear = useCallback(() => setHovered(null), []);

  return (
    <div
      className="relative mx-auto w-full max-w-[min(1120px,92vw)]"
      onMouseLeave={clear}
    >
      <div className="relative aspect-square w-full">
        {/* ---------------- SVG layer: rings, wires, core ---------------- */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            {protocols.map((p) => (
              <linearGradient
                key={p.id}
                id={`wire-${p.id}`}
                gradientUnits="userSpaceOnUse"
                x1={CENTER}
                y1={CENTER}
                x2={placed.find((q) => q.protocol.id === p.id)?.x ?? CENTER}
                y2={placed.find((q) => q.protocol.id === p.id)?.y ?? CENTER}
              >
                <stop offset="0%" stopColor={p.accent.hex} stopOpacity="0.95" />
                <stop offset="55%" stopColor={p.accent.hex} stopOpacity="0.5" />
                <stop offset="100%" stopColor={p.accent.hex} stopOpacity="0.14" />
              </linearGradient>
            ))}
            <radialGradient id="core-glow">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <filter id="wire-blur" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>

          {/* Soft pool behind the core so the centre reads as a light source. */}
          <circle cx={CENTER} cy={CENTER} r={300} fill="url(#core-glow)" />

          {/* Orbit ring. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="1"
          />
          <motion.circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line-strong)"
            strokeWidth="1"
            strokeDasharray="3 14"
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 140, repeat: Infinity, ease: "linear" }}
            style={{ originX: "50%", originY: "50%" }}
          />
          {/* Inner ring, for depth. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS - 96}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="1"
            strokeDasharray="1 9"
            opacity="0.55"
          />

          {/* Connection wires. */}
          {placed.map(({ protocol, x, y }) => {
            const isActive = active === protocol.id;
            const dimmed = active !== null && !isActive;
            return (
              <g key={protocol.id}>
                {/* Glow pass — only when this node is active. */}
                <motion.line
                  x1={CENTER}
                  y1={CENTER}
                  x2={x}
                  y2={y}
                  stroke={protocol.accent.hex}
                  strokeWidth={isActive ? 5 : 0}
                  strokeLinecap="round"
                  filter="url(#wire-blur)"
                  initial={false}
                  animate={{ opacity: isActive ? 0.45 : 0, pathLength: 1 }}
                  transition={{ duration: 0.4 }}
                />
                {/* Base wire. */}
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={x}
                  y2={y}
                  stroke={`url(#wire-${protocol.id})`}
                  strokeWidth={isActive ? 2 : 1}
                  opacity={dimmed ? 0.14 : isActive ? 1 : 0.42}
                  style={{
                    transition:
                      "opacity 320ms cubic-bezier(0.22,1,0.36,1), stroke-width 320ms",
                  }}
                />
                {/* Travelling signal dots: the "data is moving" motif. */}
                {!reduce &&
                  [0, 1, 2].map((k) => (
                    <motion.circle
                      key={k}
                      r={isActive ? 4.5 : 2.6}
                      fill={protocol.accent.hex}
                      opacity={dimmed ? 0.1 : isActive ? 1 : 0.55}
                      initial={{ cx: CENTER, cy: CENTER }}
                      animate={{ cx: [CENTER, x], cy: [CENTER, y] }}
                      transition={{
                        duration: isActive ? 1.5 : 3.2,
                        repeat: Infinity,
                        delay: k * (isActive ? 0.5 : 1.06),
                        ease: "easeInOut",
                        times: [0, 1],
                      }}
                    />
                  ))}
              </g>
            );
          })}

          {/* Central core: concentric arcs and a nominal "network" glyph. */}
          <g>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={112}
              fill="var(--color-void)"
              fillOpacity="0.86"
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
            <motion.circle
              cx={CENTER}
              cy={CENTER}
              r={112}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="1.5"
              strokeDasharray="26 200"
              strokeLinecap="round"
              opacity="0.5"
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              style={{ originX: "50%", originY: "50%" }}
            />
            <motion.circle
              cx={CENTER}
              cy={CENTER}
              r={86}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="1"
              strokeDasharray="14 120"
              strokeLinecap="round"
              opacity="0.32"
              animate={reduce ? undefined : { rotate: -360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              style={{ originX: "50%", originY: "50%" }}
            />

            {/* Miniature topology inside the core. */}
            <g opacity={active ? 0.95 : 0.75} style={{ transition: "opacity 300ms" }}>
              {[
                [-34, -22],
                [30, -30],
                [38, 26],
                [-28, 32],
                [0, 0],
              ].map(([dx, dy], i) => (
                <circle
                  key={i}
                  cx={CENTER + (dx ?? 0)}
                  cy={CENTER + (dy ?? 0)}
                  r={i === 4 ? 6.5 : 4.5}
                  fill={i === 4 ? "var(--color-ink)" : "var(--color-ink-mute)"}
                />
              ))}
              {[
                [-34, -22, 30, -30],
                [30, -30, 38, 26],
                [38, 26, -28, 32],
                [-28, 32, -34, -22],
                [-34, -22, 0, 0],
                [30, -30, 0, 0],
                [38, 26, 0, 0],
                [-28, 32, 0, 0],
              ].map(([ax, ay, bx, by], i) => (
                <line
                  key={i}
                  x1={CENTER + (ax ?? 0)}
                  y1={CENTER + (ay ?? 0)}
                  x2={CENTER + (bx ?? 0)}
                  y2={CENTER + (by ?? 0)}
                  stroke="var(--color-ink-faint)"
                  strokeWidth="1"
                />
              ))}
            </g>
          </g>
        </svg>

        {/* ---------------- HTML layer: the protocol cards ---------------- */}
        <div className="absolute inset-0">
          {/* Core caption. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 pb-[188px] sm:flex">
            <span className="atlas-label">The network</span>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 translate-y-[62px] flex-col items-center sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              {active
                ? protocols.find((p) => p.id === active)?.layer
                : "Hover to inspect"}
            </span>
          </div>

          {placed.map(({ protocol, x, y }, index) => {
            const isActive = active === protocol.id;
            const dimmed = active !== null && !isActive;
            return (
              <div
                key={protocol.id}
                className="absolute"
                style={{
                  left: `${(x / SIZE) * 100}%`,
                  top: `${(y / SIZE) * 100}%`,
                  width: `${(NODE / SIZE) * 100}%`,
                  aspectRatio: "1 / 1",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <ProtocolNode
                  index={index}
                  protocol={protocol}
                  isActive={isActive}
                  dimmed={dimmed}
                  reduce={!!reduce}
                  onHover={() => setHovered(protocol.id)}
                  onFocus={() => setFocused(protocol.id)}
                  onBlur={() => setFocused(null)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover preview, rendered outside the aspect box so it cannot be
          clipped by a transforming ancestor. */}
      <AnimatePresence>
        {active ? (
          <OrbitPreview
            key={active}
            protocol={protocols.find((p) => p.id === active)!}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProtocolNode({
  protocol,
  index,
  isActive,
  dimmed,
  reduce,
  onHover,
  onFocus,
  onBlur,
}: {
  protocol: ProtocolDefinition;
  index: number;
  isActive: boolean;
  dimmed: boolean;
  reduce: boolean;
  onHover: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <MotionLink
      href={`/${protocol.id}`}
      onMouseEnter={onHover}
      onFocus={onFocus}
      onBlur={onBlur}
      initial={reduce ? false : { opacity: 0, scale: 0.82 }}
      animate={{
        opacity: dimmed ? 0.34 : 1,
        scale: isActive ? 1.06 : 1,
      }}
      transition={{
        opacity: { duration: 0.3 },
        scale: { type: "spring", stiffness: 380, damping: 26, delay: reduce ? 0 : index * 0.05 },
        default: { duration: reduce ? 0 : 0.6, delay: reduce ? 0 : index * 0.07 + 0.15 },
      }}
      className="group relative flex h-full w-full flex-col items-center justify-center rounded-full text-center outline-offset-4"
      style={{
        backgroundColor: isActive
          ? "oklch(0.215 0.011 265 / 0.94)"
          : "oklch(0.178 0.010 265 / 0.82)",
        border: `1px solid ${isActive ? protocol.accent.hex : "oklch(1 0 0 / 0.09)"}`,
        backdropFilter: "blur(16px)",
        boxShadow: isActive
          ? `0 0 0 6px ${protocol.accent.soft}, 0 24px 60px -22px ${protocol.accent.hex}`
          : "inset 0 1px 0 0 oklch(1 0 0 / 0.05), 0 6px 22px -12px oklch(0 0 0 / 0.7)",
        transition:
          "background-color 320ms cubic-bezier(0.22,1,0.36,1), border-color 320ms, box-shadow 320ms",
      }}
      aria-label={`${protocol.name} — ${protocol.longName}. ${protocol.hook}`}
    >
      {/* Rotating accent arc around the active node. */}
      {isActive && !reduce ? (
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <motion.circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke={protocol.accent.hex}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="42 260"
            animate={{ rotate: 360 }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
            style={{ originX: "50%", originY: "50%" }}
          />
        </svg>
      ) : null}

      <span
        className="atlas-label mb-1.5 transition-colors duration-300"
        style={{ color: isActive ? protocol.accent.hex : undefined }}
      >
        {protocol.layer.split(" ")[0]}
      </span>

      <span
        className="font-mono text-[clamp(1.05rem,2.4vw,1.6rem)] font-medium leading-none tracking-tight"
        style={{ color: isActive ? protocol.accent.hex : "var(--color-ink)" }}
      >
        {protocol.name}
      </span>

      <span className="mt-2 max-w-[82%] text-[clamp(0.5rem,0.95vw,0.62rem)] leading-snug text-ink-mute">
        {protocol.subtitle}
      </span>

      {/* Status dot — a small always-present indicator. */}
      <span className="absolute bottom-[13%] flex items-center gap-1.5">
        <motion.span
          className="h-1 w-1 rounded-full"
          style={{ backgroundColor: protocol.accent.hex }}
          animate={
            reduce
              ? undefined
              : { opacity: isActive ? [1, 0.35, 1] : 0.55, scale: isActive ? [1, 1.6, 1] : 1 }
          }
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
      </span>
    </MotionLink>
  );
}

/* ------------------------------------------------------------------ */

function OrbitPreview({ protocol }: { protocol: ProtocolDefinition }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.22 }}
      className="pointer-events-none mx-auto -mt-2 hidden w-full max-w-lg lg:block"
      aria-hidden="true"
    >
      <div
        className="atlas-panel relative overflow-hidden rounded-lg px-4 py-3"
        style={{ borderColor: `${protocol.accent.hex}55` }}
      >
        <div
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: protocol.accent.hex }}
        />
        <div className="flex items-start gap-3 pl-2">
          <span
            className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: protocol.accent.hex }}
          >
            {protocol.name}
          </span>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            {protocol.hook}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
