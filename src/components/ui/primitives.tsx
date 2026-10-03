import type { Accent } from "@/data/types";

/**
 * The mono micro-label used for every technical annotation on the site.
 * Kept as a component so the tracking and casing can never drift.
 */
export function Label({
  children,
  className = "",
  strong = false,
}: {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <span
      className={`atlas-label ${strong ? "atlas-label-strong" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

/** A numbered section marker: `03 — PACKET STRUCTURE`. */
export function SectionMarker({
  index,
  children,
  accent,
  accentHex,
}: {
  index: string;
  children: React.ReactNode;
  accent?: Accent;
  /** Convenience for sections that only have a raw colour, not a full Accent. */
  accentHex?: string;
}) {
  const colour = accent?.hex ?? accentHex ?? "var(--color-ink-mute)";
  const ruleColour = accent?.hex ?? accentHex ?? "var(--color-line-strong)";
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] tabular-nums" style={{ color: colour }}>
        {index}
      </span>
      <span className="h-px w-6" style={{ backgroundColor: ruleColour }} />
      <Label strong>{children}</Label>
    </div>
  );
}

/** A small coloured chip naming a layer or category. */
export function Chip({
  children,
  accent,
  className = "",
}: {
  children: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${className}`}
      style={{
        borderColor: accent ? `${accent.hex}40` : "var(--color-line)",
        color: accent ? accent.hex : "var(--color-ink-mute)",
        backgroundColor: accent ? accent.soft : "transparent",
      }}
    >
      {children}
    </span>
  );
}

/** Key/value row in mono, used all over the slides. */
export function FactList({
  facts,
  accent,
  className = "",
}: {
  facts: { key: string; value: string }[];
  accent?: Accent;
  className?: string;
}) {
  return (
    <dl className={`divide-y divide-line/60 ${className}`}>
      {facts.map((fact) => (
        <div
          key={fact.key}
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
        >
          <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            {fact.key}
          </dt>
          <dd
            className="font-mono text-[13px]"
            style={{ color: accent ? accent.hex : "var(--color-ink-soft)" }}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The visual container for every diagram on the site.
 *
 * Having one frame means every diagram looks like it belongs to the same
 * drawing set: same grid, same corner ticks, same border weight.
 */
export function DiagramFrame({
  children,
  className = "",
  label,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  tone?: "default" | "inset";
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${
        tone === "inset" ? "bg-void/40" : "bg-surface/40"
      } ${className}`}
      style={{ border: "1px solid var(--color-line)" }}
    >
      <div className="atlas-grid-fine pointer-events-none absolute inset-0 opacity-60" />
      {/* Corner ticks: a cheap, consistent way to make a frame read as technical. */}
      <span className="pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-line-strong" />
      <span className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-line-strong" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-line-strong" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-line-strong" />
      {label ? (
        <div className="absolute right-3 top-2.5 z-10">
          <Label>{label}</Label>
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}
