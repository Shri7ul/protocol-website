import type { ReactNode } from "react";

import { SectionMarker } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Page section wrapper.
 *
 * Every landing-page section shares the same vertical rhythm and the same
 * max-width rail, so the whole page reads as one continuous document rather
 * than a set of pasted blocks.
 */
export function Section({
  id,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Full-bleed sections skip the max-width rail (used by the orbit). */
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-20 border-t border-line/70 py-16 sm:py-24",
        className,
      )}
    >
      <div
        className={cn(
          !bleed && "mx-auto max-w-[1400px] px-5 sm:px-8",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Standard section heading: numbered marker, display title, lead paragraph.
 * Having one component means no section can drift in type scale or spacing.
 */
export function SectionHeading({
  marker,
  label,
  title,
  lead,
  accentHex,
  aside,
}: {
  marker: string;
  label: string;
  title: string;
  lead: string;
  accentHex?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-10 sm:mb-14">
      <SectionMarker index={marker} accentHex={accentHex}>
        {label}
      </SectionMarker>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
        <h2 className="atlas-headline text-[clamp(1.85rem,4.2vw,3.1rem)] font-medium text-ink">
          {title}
        </h2>
        <p className="max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
          {lead}
        </p>
      </div>

      {aside ? <div className="mt-8">{aside}</div> : null}
    </div>
  );
}
