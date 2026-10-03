"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ComparisonTable } from "@/components/presentation/comparison-table";
import { ConceptCard } from "@/components/presentation/concept-card";
import { HeaderVisualizer } from "@/components/presentation/header-visualizer";
import { PacketAnimation } from "@/components/presentation/packet-animation";
import { ProgressIndicator } from "@/components/presentation/progress-indicator";
import { Chip, FactList, Label } from "@/components/ui/primitives";
import { protocols } from "@/data/registry";
import type { ProtocolDefinition } from "@/data/types";
import { pad } from "@/lib/utils";

/**
 * ProtocolPresentation — the generic seven-slide shell.
 *
 * One component renders all six protocols. Nothing about a protocol's layout
 * is hard-coded here: every slide reads from the `ProtocolDefinition` it is
 * handed. Adding a seventh protocol requires no changes to this file.
 *
 * Slide order (fixed for every protocol, so the reading rhythm is predictable):
 *   01 Intro · 02 Why it exists · 03 How it works · 04 Structure
 *   05 Real world · 06 Comparison · 07 Recap
 *
 * Navigation: arrow keys, space, home/end, ESC back to the overview, plus
 * clickable dots and prev/next. The slide index lives in component state, not
 * in the URL, so the page is fully static and prerenderable.
 */

const SLIDE_TITLES = [
  "Introduction",
  "Why it exists",
  "How it works",
  "Structure",
  "Real world",
  "Comparison",
  "Recap",
] as const;

export function ProtocolPresentation({ protocol }: { protocol: ProtocolDefinition }) {
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduce = useReducedMotion();
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);

  const total = SLIDE_TITLES.length;
  const accent = protocol.accent;
  const hex = accent.hex;

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setDirection(clamped > slide ? 1 : -1);
      setSlide(clamped);
      // Move focus to the stage so a keyboard user stays oriented. Scroll is
      // left alone (`preventScroll: true`) — slides have different heights, so
      // scrolling to the stage on every arrow press would yank the reader to a
      // new position mid-read.
      stageRef.current?.focus({ preventScroll: true });
    },
    [slide, total],
  );

  /* Keyboard control. Bound to the window so the whole page is operable
     without first clicking the deck. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack keys while the user is typing or interacting with a
      // control that owns them (links, buttons, form fields).
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          go(slide + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          go(slide - 1);
          break;
        case " ":
        case "Spacebar":
          e.preventDefault();
          go(slide + 1);
          break;
        case "Home":
          e.preventDefault();
          go(0);
          break;
        case "End":
          e.preventDefault();
          go(total - 1);
          break;
        case "Escape":
          /*
           * Escape returns to the overview, per the brief.
           *
           * Via the router rather than `window.location`, so the transition
           * stays client-side and Next can preserve the scroll position of the
           * landing page instead of reloading it from scratch.
           */
          router.push("/#universe");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, router, slide, total]);

  /* Warn-free alternative to mutating history: keep the document title in
     sync with the slide so the browser tab reflects progress. */
  useEffect(() => {
    document.title = `${protocol.name} · ${pad(slide + 1)} — ${SLIDE_TITLES[slide]}`;
  }, [protocol.name, slide]);

  const otherProtocols = useMemo(
    () => protocols.filter((p) => p.id !== protocol.id),
    [protocol.id],
  );

  return (
    <div
      className="relative min-h-dvh"
      style={{ ["--accent" as string]: hex, ["--accent-soft" as string]: accent.soft }}
    >
      {/* Ambient accent wash behind everything, unique per protocol. */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% -8%, ${hex}1c, transparent 62%)`,
        }}
        aria-hidden="true"
      />
      <div className="atlas-grid pointer-events-none fixed inset-0 opacity-70" aria-hidden="true" />

      {/* ------------------------- deck chrome ------------------------- */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-24 pt-20 sm:px-8 sm:pt-24">
        {/* Navigation bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[13px] font-medium tracking-wide"
              style={{ color: hex }}
            >
              {protocol.name}
            </span>
            <span className="h-3 w-px bg-line-strong" aria-hidden="true" />
            <span className="atlas-label tabular-nums">
              {pad(slide + 1)} — {SLIDE_TITLES[slide]?.toUpperCase()}
            </span>
          </div>

          <ProgressIndicator
            total={total}
            current={slide}
            accentHex={hex}
            labels={[...SLIDE_TITLES]}
            onSelect={(i) => {
              setDirection(i > slide ? 1 : -1);
              setSlide(i);
            }}
          />
        </div>

        {/* ------------------------- the stage ------------------------- *
         * All seven slides are rendered, always. The inactive ones are
         * hidden with `hidden` (display:none) rather than unmounted, so the
         * complete text of every slide is present in the prerendered HTML —
         * crawlers and no-JS readers see all seven, not just the first.
         *
         * The animation is driven per-slide with `initial`/`animate` keyed on
         * whether that slide is the active one, so switching still slides in
         * from the correct direction. `AnimatePresence` is gone because
         * nothing exits: enter-only motion reads the same and costs less.
         * ------------------------------------------------------------------ */}
        <div
          ref={stageRef}
          tabIndex={-1}
          role="group"
          aria-roledescription="carousel"
          aria-label={`${protocol.name} presentation, slide ${slide + 1} of ${total}: ${SLIDE_TITLES[slide]}`}
          className="outline-none"
        >
          {SLIDE_TITLES.map((title, i) => {
            const active = i === slide;
            return (
              <div
                key={title}
                id={`slide-${i + 1}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${i + 1} of ${total}: ${title}`}
                aria-hidden={active ? undefined : true}
                hidden={!active}
              >
                {/* Slide 01 already renders the protocol name as the page
                    <h1>; every other slide gets a real <h2> so the document
                    outline is intact when a crawler or reader walks it. */}
                {i > 0 ? <h2 className="sr-only">{title}</h2> : null}
                <motion.div
                  initial={false}
                  animate={
                    active
                      ? { opacity: 1, x: 0 }
                      : { opacity: 0, x: reduce ? 0 : direction * 24 }
                  }
                  transition={{
                    duration: reduce ? 0 : 0.32,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {i === 0 ? <SlideIntro protocol={protocol} /> : null}
                  {i === 1 ? <SlideWhy protocol={protocol} /> : null}
                  {i === 2 ? <SlideHow protocol={protocol} /> : null}
                  {i === 3 ? <SlideStructure protocol={protocol} /> : null}
                  {i === 4 ? <SlideRealWorld protocol={protocol} /> : null}
                  {i === 5 ? <SlideComparison protocol={protocol} /> : null}
                  {i === 6 ? (
                    <SlideRecap
                      protocol={protocol}
                      others={otherProtocols}
                      onReplay={() => {
                        setDirection(-1);
                        setSlide(0);
                      }}
                    />
                  ) : null}
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* ------------------------- deck controls ------------------------- */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => go(slide - 1)}
            disabled={slide === 0}
            className="inline-flex items-center gap-2.5 rounded-lg border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
              <path
                d="M9 3L4 7l5 4"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Previous
          </button>

          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint sm:block">
            ← → space · esc for overview
          </span>

          <button
            type="button"
            onClick={() => go(slide + 1)}
            disabled={slide === total - 1}
            className="inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: hex, color: "var(--color-void)" }}
          >
            Next
            <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
              <path
                d="M5 3l5 4-5 4"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * SLIDE 01 — INTRO
 * ================================================================== */

function SlideIntro({ protocol }: { protocol: ProtocolDefinition }) {
  const reduce = useReducedMotion();
  const firstSequence = protocol.mechanics.steps.find((s) => s.sequence)?.sequence;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
      <div className="flex flex-col justify-center">
        <motion.div
          initial={reduce ? false : { y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Chip accent={protocol.accent}>{protocol.layer}</Chip>
            <Chip accent={protocol.accent}>{protocol.communication}</Chip>
          </div>

          <h1
            className="atlas-display mt-6 text-[clamp(3.2rem,11vw,7rem)] font-medium"
            style={{ color: protocol.accent.hex }}
          >
            {protocol.name}
          </h1>

          <p className="mt-2 text-[clamp(1rem,2.2vw,1.4rem)] font-medium tracking-tight text-ink-soft">
            {protocol.longName}
          </p>

          <div className="mt-8 max-w-xl">
            <FactList
              accent={protocol.accent}
              facts={[
                { key: "Layer", value: protocol.layer },
                { key: "Communication", value: protocol.communication },
                { key: "Purpose", value: protocol.purpose },
              ]}
            />
          </div>

          <p className="mt-7 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
            {protocol.intro}
          </p>
        </motion.div>
      </div>

      {/* The signature animation for this protocol. */}
      <div className="flex flex-col justify-center">
        <div
          className="relative overflow-hidden rounded-xl p-5 sm:p-6"
          style={{
            border: `1px solid ${protocol.accent.hex}30`,
            backgroundColor: "oklch(0.178 0.010 265 / 0.55)",
          }}
        >
          <div
            className="atlas-grid-fine pointer-events-none absolute inset-0 opacity-50"
            aria-hidden="true"
          />

          {firstSequence ? (
            <PacketAnimation
              sequence={firstSequence}
              accentHex={protocol.accent.hex}
            />
          ) : null}

          <p className="relative mt-5 border-t border-line/60 pt-4 text-[12.5px] leading-relaxed text-ink-mute">
            {protocol.hook}
          </p>
        </div>

        {/* A compact identity strip: layer position + accent. */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { k: "Accent", v: protocol.id.toUpperCase() },
            { k: "Slides", v: "07" },
            { k: "Steps", v: pad(protocol.mechanics.steps.length) },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-lg border border-line bg-surface/40 px-3 py-2.5"
            >
              <span className="atlas-label">{s.k}</span>
              <p
                className="mt-1 font-mono text-[13px] tabular-nums"
                style={{ color: protocol.accent.hex }}
              >
                {s.v}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * SLIDE 02 — WHY DOES IT EXIST?
 * ================================================================== */

function SlideWhy({ protocol }: { protocol: ProtocolDefinition }) {
  const reduce = useReducedMotion();

  return (
    <div>
      <div className="mb-10 grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* The problem, stated then enumerated. */}
        <motion.div
          initial={reduce ? false : { x: -14 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-xl border p-5 sm:p-6"
          style={{
            borderColor: "#e8674a35",
            backgroundColor: "#e8674a0a",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]"
              style={{ backgroundColor: "#e8674a22", color: "#e8674a" }}
            >
              !
            </span>
            <Label strong>The problem</Label>
          </div>

          <h2 className="atlas-headline mt-4 text-[clamp(1.3rem,2.8vw,1.9rem)] font-medium text-ink">
            {protocol.problem.headline}
          </h2>

          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
            {protocol.problem.detail}
          </p>

          <ul className="mt-5 flex flex-col gap-2 border-t border-line/60 pt-4">
            {protocol.problem.failures.map((failure, i) => (
              <motion.li
                key={failure}
                initial={reduce ? false : { x: -8 }}
                animate={{ x: 0 }}
                transition={{ delay: reduce ? 0 : 0.05 * i + 0.15, duration: 0.35 }}
                className="flex items-start gap-2.5"
              >
                <span
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: "#e8674a" }}
                  aria-hidden="true"
                />
                <span className="text-[12.5px] leading-relaxed text-ink-mute">
                  {failure}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* The solution, as a headline plus a transition arrow. */}
        <motion.div
          initial={reduce ? false : { x: 14 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col justify-center rounded-xl border p-5 sm:p-6"
          style={{
            borderColor: `${protocol.accent.hex}35`,
            backgroundColor: `${protocol.accent.hex}0a`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]"
              style={{
                backgroundColor: `${protocol.accent.hex}22`,
                color: protocol.accent.hex,
              }}
            >
              ✓
            </span>
            <Label strong>The solution</Label>
          </div>

          <h2 className="atlas-headline mt-4 text-[clamp(1.3rem,2.8vw,1.9rem)] font-medium text-ink">
            {protocol.solution.headline}
          </h2>

          <div className="mt-6 flex flex-col gap-2.5">
            {protocol.solution.concepts.slice(0, 4).map((c) => (
              <div
                key={c.title}
                className="flex items-start gap-3 rounded-lg border border-line/70 bg-void/30 px-3 py-2.5"
              >
                <span
                  className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: protocol.accent.hex }}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-ink">
                    {c.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-mute">
                    {c.body.split(".")[0]}.
                  </span>
                </span>
              </div>
            ))}
            {protocol.solution.concepts.length > 4 ? (
              <p className="atlas-label pl-1">
                + {protocol.solution.concepts.length - 4} more below
              </p>
            ) : null}
          </div>
        </motion.div>
      </div>

      {/* Every mechanism, as its own visual card. */}
      <div className="mb-5 flex items-center gap-3">
        <span className="h-px w-6" style={{ backgroundColor: protocol.accent.hex }} />
        <Label strong>
          {protocol.solution.concepts.length} mechanisms, each solving one thing
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {protocol.solution.concepts.map((concept, i) => (
          <ConceptCard
            key={concept.title}
            concept={concept}
            accentHex={protocol.accent.hex}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

/* ================================================================== *
 * SLIDE 03 — HOW IT WORKS
 * ================================================================== */

function SlideHow({ protocol }: { protocol: ProtocolDefinition }) {
  const [openStep, setOpenStep] = useState(0);
  const reduce = useReducedMotion();
  const step = protocol.mechanics.steps[openStep];

  return (
    <div>
      <p className="mb-8 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">
        {protocol.mechanics.framing}
      </p>

      {/* The encapsulation stack this protocol sits inside. */}
      <div className="mb-8 overflow-hidden rounded-xl border border-line bg-surface/40">
        <div className="flex flex-wrap items-stretch">
          {protocol.mechanics.stack.map((layer, i, arr) => (
            <div key={layer.label} className="flex min-w-0 flex-1 items-stretch">
              <div
                className="flex min-w-[104px] flex-1 flex-col justify-center px-3.5 py-3"
                style={{
                  backgroundColor: layer.emphasis
                    ? `${protocol.accent.hex}1a`
                    : "transparent",
                  borderLeft: layer.emphasis
                    ? `2px solid ${protocol.accent.hex}`
                    : "2px solid transparent",
                }}
              >
                <span
                  className="truncate font-mono text-[11.5px] font-medium"
                  style={{
                    color: layer.emphasis
                      ? protocol.accent.hex
                      : "var(--color-ink-soft)",
                  }}
                >
                  {layer.label}
                </span>
                {layer.sub ? (
                  <span className="mt-0.5 truncate text-[10.5px] text-ink-faint">
                    {layer.sub}
                  </span>
                ) : null}
              </div>
              {i < arr.length - 1 ? (
                <span
                  className="flex w-5 shrink-0 items-center justify-center text-ink-faint"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 8 12" className="h-3.5 w-2.5">
                    <path
                      d="M2 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10">
        {/* The clickable step list. */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Label strong>The sequence</Label>
            <Label>{pad(protocol.mechanics.steps.length)} steps</Label>
          </div>

          <ol className="flex flex-col gap-1.5">
            {protocol.mechanics.steps.map((s, i) => {
              const isOpen = i === openStep;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setOpenStep(i)}
                    aria-expanded={isOpen}
                    aria-current={isOpen ? "step" : undefined}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200"
                    style={{
                      backgroundColor: isOpen
                        ? "oklch(0.215 0.011 265 / 0.85)"
                        : "oklch(0.178 0.010 265 / 0.4)",
                      border: `1px solid ${
                        isOpen ? `${protocol.accent.hex}45` : "var(--color-line)"
                      }`,
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] tabular-nums transition-colors"
                      style={{
                        backgroundColor: isOpen
                          ? protocol.accent.hex
                          : "var(--color-raised)",
                        color: isOpen ? "var(--color-void)" : "var(--color-ink-faint)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-[12.5px] font-medium leading-snug"
                        style={{
                          color: isOpen
                            ? "var(--color-ink)"
                            : "var(--color-ink-soft)",
                        }}
                      >
                        {s.title}
                      </span>
                      <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-mute">
                        {s.summary}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The expanded step. */}
        <div>
          <AnimatePresence mode="wait">
            {step ? (
              <motion.div
                key={step.id}
                initial={reduce ? false : { y: 12 }}
                animate={{ y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.26 }}
                className="rounded-xl border p-5 sm:p-6"
                style={{
                  borderColor: `${protocol.accent.hex}30`,
                  backgroundColor: "oklch(0.178 0.010 265 / 0.6)",
                }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: protocol.accent.hex }}
                  >
                    STEP {pad(openStep + 1)}
                  </span>
                  <span className="h-3 w-px bg-line-strong" aria-hidden="true" />
                  <h3 className="atlas-headline text-[clamp(1.15rem,2.4vw,1.6rem)] font-medium text-ink">
                    {step.title}
                  </h3>
                </div>

                <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>

                {step.facts && step.facts.length > 0 ? (
                  <div className="mt-5 overflow-hidden rounded-lg border border-line/80 bg-void/40">
                    {step.facts.map((f) => (
                      <div
                        key={f.key}
                        className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-line/50 px-3.5 py-2.5 last:border-0"
                      >
                        <span className="w-[124px] shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
                          {f.key}
                        </span>
                        <span
                          className="min-w-0 flex-1 break-words font-mono text-[12.5px]"
                          style={{ color: protocol.accent.hex }}
                        >
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {step.sequence ? (
                  <div className="mt-6 border-t border-line/60 pt-5">
                    <PacketAnimation
                      sequence={step.sequence}
                      accentHex={protocol.accent.hex}
                      compact
                    />
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * SLIDE 04 — PACKET / FRAME STRUCTURE
 * ================================================================== */

function SlideStructure({ protocol }: { protocol: ProtocolDefinition }) {
  return (
    <div>
      <p className="mb-8 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">
        The {protocol.frame.unit.toLowerCase()}, field by field. Every field is
        sized to its real proportions and labelled with its width in the
        specification. Select one to see what it does and a value from a live
        packet.
      </p>

      <HeaderVisualizer
        rows={protocol.frame.rows}
        unit={protocol.frame.unit}
        overhead={protocol.frame.overhead}
        note={protocol.frame.note}
        accentHex={protocol.accent.hex}
      />
    </div>
  );
}

/* ================================================================== *
 * SLIDE 05 — REAL WORLD EXAMPLE
 * ================================================================== */

function SlideRealWorld({ protocol }: { protocol: ProtocolDefinition }) {
  const reduce = useReducedMotion();
  const example = protocol.realWorld;

  return (
    <div>
      <h2 className="atlas-headline text-[clamp(1.4rem,3.2vw,2.2rem)] font-medium text-ink">
        {example.title}
      </h2>
      <p className="mt-3.5 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">
        {example.scenario}
      </p>

      {/* The hop chain, vertical on small screens, horizontal on wide. */}
      <ol className="mt-9 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {example.hops.map((hop, i) => (
          <motion.li
            key={hop.label}
            initial={reduce ? false : { y: 14 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.42, delay: reduce ? 0 : i * 0.07 }}
            className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-stretch"
          >
            <div
              className="flex min-w-0 flex-1 flex-col rounded-xl p-4"
              style={{
                backgroundColor: "oklch(0.178 0.010 265 / 0.6)",
                border: `1px solid ${protocol.accent.hex}28`,
              }}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{ color: protocol.accent.hex }}
                >
                  {pad(i + 1)}
                </span>
                <span className="text-[13px] font-medium text-ink">{hop.label}</span>
              </div>

              {hop.sub ? (
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
                  {hop.sub}
                </p>
              ) : null}

              {hop.facts && hop.facts.length > 0 ? (
                <dl className="mt-3.5 flex flex-col gap-1.5 border-t border-line/60 pt-3">
                  {hop.facts.map((f) => (
                    <div key={f.key} className="min-w-0">
                      <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                        {f.key}
                      </dt>
                      <dd
                        className="break-words font-mono text-[11.5px] leading-snug"
                        style={{ color: protocol.accent.hex }}
                      >
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>

            {i < example.hops.length - 1 ? (
              <div
                className="flex shrink-0 items-center justify-center py-1 lg:w-7 lg:py-0"
                aria-hidden="true"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3 rotate-90 text-line-strong lg:rotate-0">
                  <path
                    d="M4 2l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : null}
          </motion.li>
        ))}
      </ol>

      {/* The point of the slide. */}
      <div
        className="mt-8 rounded-xl border p-5"
        style={{
          borderColor: `${protocol.accent.hex}30`,
          backgroundColor: `${protocol.accent.hex}0a`,
        }}
      >
        <Label strong>Why this matters</Label>
        <p className="mt-2.5 max-w-4xl text-[13.5px] leading-relaxed text-ink-soft">
          {example.moral}
        </p>
      </div>
    </div>
  );
}

/* ================================================================== *
 * SLIDE 06 — COMPARISON
 * ================================================================== */

function SlideComparison({ protocol }: { protocol: ProtocolDefinition }) {
  return (
    <div>
      <h2 className="atlas-headline mb-6 text-[clamp(1.4rem,3.2vw,2.2rem)] font-medium text-ink">
        {protocol.comparison.title}
      </h2>
      <ComparisonTable comparison={protocol.comparison} />
    </div>
  );
}

/* ================================================================== *
 * SLIDE 07 — QUICK RECAP
 * ================================================================== */

function SlideRecap({
  protocol,
  others,
  onReplay,
}: {
  protocol: ProtocolDefinition;
  others: ProtocolDefinition[];
  onReplay: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-14">
        <div>
          <h2
            className="atlas-display text-[clamp(1.8rem,4.6vw,3.2rem)] font-medium"
            style={{ color: protocol.accent.hex }}
          >
            {protocol.recap.headline}
          </h2>

          <ol className="mt-8 flex flex-col">
            {protocol.recap.points.map((point, i) => (
              <motion.li
                key={point}
                initial={reduce ? false : { x: -10 }}
                whileInView={{ x: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.06 }}
                className="flex items-baseline gap-4 border-b border-line/60 py-3.5"
              >
                <span
                  className="shrink-0 font-mono text-[11px] tabular-nums"
                  style={{ color: protocol.accent.hex }}
                >
                  {pad(i + 1)}
                </span>
                <span className="text-[13.5px] leading-relaxed text-ink-soft">
                  {point}
                </span>
              </motion.li>
            ))}
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex items-center gap-2.5 rounded-lg border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            >
              <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
                <path
                  d="M12 7a5 5 0 11-1.6-3.7M12 2v3h-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Replay visual
            </button>

            <Link
              href="/#universe"
              className="inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: protocol.accent.hex, color: "var(--color-void)" }}
            >
              Explore another protocol
              <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
                <path
                  d="M5 3l5 4-5 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* Jump to a protocol that pairs with this one. */}
          <div>
            <Label strong>Reads well alongside</Label>
            <ul className="mt-3 flex flex-col gap-2">
              {others
                .filter((o) => protocol.related.includes(o.id))
                .map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/${o.id}`}
                      className="group flex items-center gap-3 rounded-lg border border-line bg-surface/40 px-3.5 py-3 transition-colors hover:border-line-strong"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: o.accent.hex }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12.5px] font-medium text-ink">
                          {o.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-ink-mute">
                          {o.subtitle}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-ink-faint transition-colors group-hover:text-ink-soft">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {/* Sources, so every claim is checkable. */}
          <div>
            <Label strong>Primary sources</Label>
            <ul className="mt-3 flex flex-col gap-2.5">
              {protocol.references.map((ref) => (
                <li
                  key={ref.label}
                  className="rounded-lg border border-line/70 bg-void/30 px-3.5 py-3"
                >
                  <span className="block font-mono text-[11.5px] leading-snug text-ink-soft">
                    {ref.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-ink-faint">
                    {ref.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
