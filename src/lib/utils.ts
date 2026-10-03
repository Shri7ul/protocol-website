import { clsx, type ClassValue } from "clsx";
import type { CSSProperties } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Renders a protocol accent as inline CSS custom properties.
 *
 * Components never hard-code a protocol colour. They read `--accent`,
 * `--accent-soft` and (where a glow is wanted) `--accent-glow`, so the same
 * markup works for all six protocols and any future one.
 */
export function accentVars(hex: string, soft: string) {
  return {
    "--accent": hex,
    "--accent-soft": soft,
    "--accent-glow": `${hex}40`,
  } as CSSProperties;
}

/** Zero-pads a slide or step number for the mono progress indicator. */
export function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}
