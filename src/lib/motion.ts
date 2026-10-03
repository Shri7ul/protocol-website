/**
 * Motion policy — one place that decides whether content is ever hidden.
 *
 * ─── The bug this exists to prevent ─────────────────────────────────────────
 *
 * `initial={{ opacity: 0 }}` is written into the server-rendered HTML as
 * `style="opacity:0"`. That is the correct default for Framer Motion, and for
 * a *client-rendered* app it is harmless: hydration runs the animation and the
 * opacity reaches 1.
 *
 * It is not harmless for statically prerendered pages. The served document —
 * what a visitor sees on first paint, what a crawler indexes, and what an
 * ad-blocked or script-failed browser is left with — contains the element
 * marked invisible with no CSS rule anywhere that would ever reveal it. The
 * only thing that can raise the opacity is JavaScript.
 *
 * Measured on the previous build: 48–63 elements per page carried
 * `style="opacity:0"`, including the entire body copy of every slide. The page
 * background and the accent circles (plain CSS and SVG, never motion-wrapped)
 * rendered fine — which is exactly the reported symptom: "the background and
 * coloured circles render, but the text/content is missing."
 *
 * ─── Two distinct failure modes ─────────────────────────────────────────────
 *
 *   `animate`       Runs on mount. Recovers as soon as React hydrates, so it
 *                   degrades to a brief flash of missing text.
 *
 *   `whileInView`   Runs only when the element scrolls into the viewport,
 *                   observed by IntersectionObserver. If that observer never
 *                   fires — JS blocked, hydration error, an extension hiding
 *                   the observer, or the element already scrolled past — the
 *                   element stays at opacity 0 permanently.
 *
 * The second is strictly worse and there are 30 of them across the site.
 *
 * ─── The policy ─────────────────────────────────────────────────────────────
 *
 * Never make opacity the thing that gates visibility. Motion is decoration
 * layered on content that is *already* legible, so every variant here leaves
 * the element visible in the served HTML and animates only position and scale.
 *
 *   rise / slideIn   content is visible at rest; motion is transform-only
 *
 * `REDUCED` is the same shape with zero distance, for the
 * `prefers-reduced-motion` branch, so callers can keep `useReducedMotion()`
 * and change only the arguments. The global CSS rule in `globals.css` already
 * collapses durations; this stops the *movement* rather than just speeding it
 * up.
 *
 * ─── Why transform-only is safe ─────────────────────────────────────────────
 *
 * A `transform` on an invisible-to-visible transition can strand content off
 * its own layout box, but never hides it: `translateY(14px)` and
 * `translateY(0)` both render fully opaque. So the worst case of a
 * never-firing animation is a 14-pixel offset, not a blank page.
 */

/** Signature matching Framer Motion's `ViewportOptions`. */
export const VIEWPORT_ONCE = { once: true, margin: "-40px" } as const;

/** A short, slightly-overshooting ease used across the site. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Content that is visible at rest; animates a short distance upward.
 *
 * Use for anything gated behind `whileInView`, where a non-firing observer
 * would otherwise hide it forever.
 */
export function rise(distance = 14, delay = 0) {
  return {
    initial: { y: distance },
    whileInView: { y: 0 },
    viewport: VIEWPORT_ONCE,
    transition: { duration: 0.45, ease: EASE, delay },
  };
}

/**
 * As `rise`, but for elements that animate on mount (`animate`) rather than on
 * scroll. `delay` is passed through so staggered entrance sequences keep their
 * rhythm.
 */
export function enter(distance = 14, delay = 0, duration = 0.5) {
  return {
    initial: { y: distance },
    animate: { y: 0 },
    transition: { duration, ease: EASE, delay },
  };
}

/** Horizontal variant of `rise`; negative distances come from the left. */
export function slideIn(distance = 14, delay = 0) {
  return {
    initial: { x: distance },
    whileInView: { x: 0 },
    viewport: VIEWPORT_ONCE,
    transition: { duration: 0.45, ease: EASE, delay },
  };
}

/**
 * Reduced-motion variants.
 *
 * Same prop shape, zero travel — so a component can pick a variant and pass it
 * straight to `<motion.div {...variant} />` without branching at the JSX site.
 * Content is visible at rest in both cases, which is the invariant that
 * matters.
 */
export const RISE_REDUCED = rise(0, 0);
export const ENTER_REDUCED = enter(0, 0, 0);
export const SLIDE_REDUCED = slideIn(0, 0);
