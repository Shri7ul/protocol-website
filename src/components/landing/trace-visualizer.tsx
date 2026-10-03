"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { ACCENTS } from "@/data/accents";
import type { TraceStage } from "@/data/traces";
import { cn } from "@/lib/utils";

/**
 * TraceVisualizer — the "Trace a Request" and "Trace a Robot" sections.
 *
 * A vertical rail of stages. Selecting a stage (or letting autoplay walk
 * through them) animates a packet travelling the rail and shows the concrete
 * values visible at that moment. The rail doubles as the progress indicator.
 *
 * One component drives both scenarios: everything specific to a scenario lives
 * in `src/data/traces.ts`.
 */
export function TraceVisualizer({
  stages,
  autoPlay = false,
  loop = false,
  compact = false,
}: {
  stages: TraceStage[];
  autoPlay?: boolean;
  loop?: boolean;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const reduce = useReducedMotion();
  const railRef = useRef<HTMLOListElement>(null);

  const stage = stages[index];
  const accent = stage ? ACCENTS[stage.accent as keyof typeof ACCENTS] : undefined;
  const hex = accent?.hex ?? "#8b8f98";

  const go = useCallback(
    (next: number) => {
      if (next < 0) next = loop ? stages.length - 1 : 0;
      if (next >= stages.length) next = loop ? 0 : stages.length - 1;
      setIndex(next);
    },
    [loop, stages.length],
  );

  /* Autoplay: advance on a comfortable reading interval, and pause when the
     user takes over. Disabled entirely under reduced-motion. */
  useEffect(() => {
    if (!playing || reduce) return;
    const t = window.setTimeout(() => {
      if (index === stages.length - 1 && !loop) {
        setPlaying(false);
        return;
      }
      go(index + 1);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [playing, index, reduce, go, stages.length, loop]);

  /* Keyboard control while the visualizer has focus. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setPlaying(false);
      go(index + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setPlaying(false);
      go(index - 1);
    }
  };

  // Keep the active rail item visible *within the rail's own scroll box* on
  // mobile, where the rail is a horizontal scroller.
  //
  // Deliberately not `scrollIntoView`: on a vertically scrolling page that
  // walks up and scrolls the document itself, so every autoplay tick yanked
  // the reader back to this section from wherever they had scrolled to. We
  // only move the rail's horizontal offset, and only when it actually
  // overflows (i.e. the mobile layout).
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.children[index] as HTMLElement | undefined;
    if (!rail || !el) return;
    if (rail.scrollWidth <= rail.clientWidth) return; // not a horizontal scroller

    const target =
      el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2;
    rail.scrollTo({
      left: Math.max(0, target),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [index, reduce]);

  if (!stage) return null;

  return (
    <div
      className={cn(
        "grid gap-5 lg:gap-8",
        compact
          ? "lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"
          : "lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)]",
      )}
    >
      {/* --------------------------- the rail --------------------------- */}
      <div className="relative">
        <ol
          ref={railRef}
          className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="tablist"
          aria-label="Trace stages"
          aria-orientation="vertical"
          style={{ scrollbarWidth: "none" }}
        >
          {stages.map((s, i) => {
            const isActive = i === index;
            const isPast = i < index;
            const sAccent = ACCENTS[s.accent as keyof typeof ACCENTS];
            const sHex = sAccent?.hex ?? "#8b8f98";

            return (
              <li key={s.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`trace-panel-${s.id}`}
                  id={`trace-tab-${s.id}`}
                  onClick={() => {
                    setPlaying(false);
                    setIndex(i);
                  }}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200",
                    "min-w-[168px] lg:min-w-0",
                    isActive ? "bg-surface/80" : "hover:bg-surface/50",
                  )}
                  style={{
                    border: `1px solid ${
                      isActive ? `${sHex}55` : "transparent"
                    }`,
                  }}
                >
                  {/* Rail line + node marker. */}
                  <span className="relative flex shrink-0 items-center justify-center">
                    <span
                      className="absolute h-full w-px"
                      style={{
                        backgroundColor: isPast || isActive ? `${sHex}40` : "var(--color-line)",
                        display: i === 0 ? "none" : "block",
                        top: "-100%",
                        height: "200%",
                      }}
                      aria-hidden="true"
                    />
                    <span
                      className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[9px] tabular-nums transition-colors duration-300"
                      style={{
                        borderColor: isActive
                          ? sHex
                          : isPast
                            ? `${sHex}60`
                            : "var(--color-line)",
                        backgroundColor: isActive ? sHex : "var(--color-void)",
                        color: isActive ? "var(--color-void)" : "var(--color-ink-faint)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[12.5px] font-medium transition-colors",
                        isActive ? "text-ink" : "text-ink-mute group-hover:text-ink-soft",
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="atlas-label mt-0.5 block">{s.layer}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Playback controls. */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={!!reduce}
            className="inline-flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={playing ? "Pause the trace" : "Play the trace automatically"}
          >
            {playing ? (
              <>
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                  <rect x="1" y="1" width="2.5" height="8" fill="currentColor" />
                  <rect x="6.5" y="1" width="2.5" height="8" fill="currentColor" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                  <path d="M1.5 1l7 4-7 4z" fill="currentColor" />
                </svg>
                Play
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setIndex(0);
            }}
            className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:border-line-strong hover:text-ink"
          >
            Reset
          </button>
          <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-faint">
            {String(index + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* --------------------------- the stage --------------------------- */}
      <div className="relative min-h-[430px]">
        {/* The packet travelling down the rail, mirrored beside the panel. */}
        <div
          className="pointer-events-none absolute -left-5 top-0 hidden h-full w-px lg:block"
          aria-hidden="true"
        >
          <div className="relative h-full w-full">
            <span className="absolute inset-y-0 left-0 w-px bg-line" />
            <motion.span
              className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
              style={{ backgroundColor: hex, boxShadow: `0 0 12px ${hex}` }}
              animate={{
                top: `${(index / Math.max(stages.length - 1, 1)) * 100}%`,
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 160, damping: 22 }
              }
            />
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-xl"
          style={{
            border: `1px solid ${hex}30`,
            backgroundColor: "oklch(0.178 0.010 265 / 0.6)",
          }}
        >
          {/* Accent wash and grid, so the panel reads as the active stage. */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.5]"
            style={{
              background: `radial-gradient(ellipse 90% 70% at 50% 0%, ${hex}14, transparent 70%)`,
            }}
            aria-hidden="true"
          />
          <div className="atlas-grid-fine pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

          {/* Scanning line during playback — a subtle "instrument running" cue. */}
          {playing && !reduce ? (
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-24"
              style={{
                background: `linear-gradient(to bottom, transparent, ${hex}12, transparent)`,
              }}
              animate={{ top: ["-15%", "110%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              aria-hidden="true"
            />
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={stage.id}
              id={`trace-panel-${stage.id}`}
              role="tabpanel"
              aria-labelledby={`trace-tab-${stage.id}`}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{
                    backgroundColor: `${hex}1a`,
                    color: hex,
                    border: `1px solid ${hex}40`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: hex }}
                  />
                  {stage.layer}
                </span>
                <span className="atlas-label">{stage.label}</span>
              </div>

              <h3 className="atlas-headline mt-4 text-[clamp(1.35rem,3vw,2rem)] font-medium text-ink">
                {stage.headline}
              </h3>

              <p className="mt-3.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
                {stage.body}
              </p>

              {/* Concrete values — the thing that makes this a trace and not
                  a diagram. */}
              <div className="mt-6 overflow-hidden rounded-lg border border-line/80 bg-void/50">
                <div className="flex items-center justify-between border-b border-line/70 px-3.5 py-2">
                  <span className="atlas-label">On the wire right now</span>
                  <span className="atlas-label">{stage.facts.length} values</span>
                </div>
                <dl className="divide-y divide-line/50">
                  {stage.facts.map((f, i) => (
                    <motion.div
                      key={f.key}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reduce ? 0 : 0.06 * i + 0.1, duration: 0.3 }}
                      className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-3.5 py-2.5"
                    >
                      <dt className="w-[132px] shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                        {f.key}
                      </dt>
                      <dd
                        className="min-w-0 flex-1 break-words font-mono text-[13px]"
                        style={{ color: hex }}
                      >
                        {f.value}
                      </dd>
                    </motion.div>
                  ))}
                </dl>
              </div>

              {/* Step navigation. */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    go(index - 1);
                  }}
                  disabled={index === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                    <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    go(index + 1);
                  }}
                  disabled={index === stages.length - 1}
                  className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ backgroundColor: hex, color: "var(--color-void)" }}
                >
                  Next stage
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                    <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
