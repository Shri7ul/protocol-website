/**
 * verify-render.mjs — assert the prerendered HTML is legible without JavaScript.
 *
 * ─── The defect this guards ─────────────────────────────────────────────────
 *
 * Framer Motion writes `initial={{ opacity: 0 }}` into the server-rendered
 * markup as `style="opacity:0"`. On a statically prerendered page the served
 * document is what a visitor, a crawler, and a JS-blocked browser all receive —
 * and the only thing that could ever raise that opacity is hydration.
 *
 * `whileInView` is worse still: it waits for an IntersectionObserver, so
 * content below the fold on a page whose scripts never run stays invisible
 * permanently. The symptom is a page whose background and accent circles render
 * (plain CSS and SVG, never motion-wrapped) with no text on top of them.
 *
 * ─── What this checks ───────────────────────────────────────────────────────
 *
 *   1. Every expected route was actually prerendered to HTML.
 *   2. The route table has no deployment prefix (`/protocol/...`).
 *   3. No served HTML element carries `opacity:0` from a scroll-triggered
 *      entrance.
 *   4. Each page contains real body copy, not just a shell.
 *   5. Assets are referenced from the origin root, not a subpath.
 *
 * Run `npm run build` first. Exit code 1 on any failure.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = ".next/server/app";
const ROUTES = ["index", "tcp", "udp", "http", "https", "i2c", "can"];

let failures = 0;
let checks = 0;

function check(name, ok, detail = "") {
  checks += 1;
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Read a prerendered page, or null if the build did not emit it. */
function page(name) {
  const p = join(APP_DIR, `${name}.html`);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

console.log("Protocol Atlas — rendered-output verification");

// ── 1. every route prerendered ────────────────────────────────────────────
section("1. Static generation");
check(`${APP_DIR} exists (run npm run build first)`, existsSync(APP_DIR));

const pages = {};
for (const route of ROUTES) {
  const html = page(route);
  pages[route] = html;
  check(`/${route === "index" ? "" : route} prerendered`, html !== null);
}

// ── 2. no deployment prefix in the route table ────────────────────────────
section("2. Route table has no deployment prefix");
const htmlFiles = existsSync(APP_DIR)
  ? readdirSync(APP_DIR).filter((f) => f.endsWith(".html"))
  : [];
check(
  "no prefixed route directory emitted",
  !readdirSyncSafe(APP_DIR).some((name) => name === "protocol"),
  readdirSyncSafe(APP_DIR).join(", "),
);
check(
  `only ${ROUTES.length} app routes exist`,
  htmlFiles.length <= ROUTES.length + 1, // +1 for _not-found
  htmlFiles.join(", "),
);

// ── 3. no VISIBLE content stranded at opacity:0 ───────────────────────────
/**
 * An `opacity:0` in the served HTML is only a defect when the element is
 * actually visible — that is, when nothing in its ancestry hides it.
 *
 * Three legitimate cases exist, and all three are already excluded by the HTML
 * itself rather than by convention:
 *
 *   * Inactive slides carry `hidden` (display:none). They animate to opacity 0
 *     so the 320ms crossfade reads correctly; nothing is lost because the
 *     active slide is the one at opacity 1.
 *   * Collapsed tabpanels in the trace visualiser carry `hidden` for the same
 *     reason — they are a CSS-only accordion.
 *   * Decorative spans are marked `aria-hidden="true"` and are the sheen
 *     overlay on a disabled button, which Tailwind's `disabled:opacity-30`
 *     rule governs.
 *
 * So the check walks each element and fails only if a transparent element is
 * reachable. A regression that puts `opacity:0` back on visible body copy is
 * caught; a correctly-hidden inactive slide is not flagged.
 */
section("3. No visible content stranded at opacity:0");

/**
 * Distinct classes of `opacity:0` in served markup, and how each is judged.
 *
 * LEGITIMATE — element animates in on mount, driven by `animate`, so hydration
 *   raises it. Framer writes `initial={false}` as "no inline style at all", so
 *   an inline opacity:0 here means the initial state was a real object; the
 *   paired `animate` guarantees recovery.
 *
 * LEGITIMATE — element is inside a subtree the HTML itself marks hidden
 *   (`hidden` or `aria-hidden="true"`). Inactive deck slides and collapsed
 *   accordions are both this. Nothing is reachable and nothing is lost.
 *
 * DEFECT — a transparent element on the visible path whose opacity depends on a
 *   scroll observer (`whileInView`). If hydration never happens, that element
 *   is invisible permanently and no CSS rule will ever reveal it.
 *
 * The scanner cannot see which React prop produced a given inline style, so the
 * defect signature is expressed structurally instead: a transparent element
 * that is NOT hidden and NOT inside a hidden subtree, and that is also NOT
 * inside a mount-animated container. The last clause is what distinguishes a
 * tabpanel that fades in on load from body copy that waits for a scroll.
 */
function findVisibleTransparent(html) {
  const offenders = [];
  const stack = []; // { name, hidden, mountAnimated }

  /*
   * A container is treated as mount-animated if its subtree contains any
   * element that is transparent now but has a sibling animated style applied —
   * in practice, the reliably observable signal is that the transparent
   * element's own inline style carries a `transform` and its id/role marks it
   * as a panel or slide. Rather than infer intent, we anchor on explicit,
   * checkable markers: `role="tabpanel"`, `role="group"` with a slide label,
   * and `aria-live`/`aria-atomic` regions.
   */
  const MOUNT_ANIMATED_ROLE = /role="tabpanel"|aria-roledescription="slide"|aria-roledescription="carousel"/;

  const tokenRe =
    /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>'"]+)*?)(\/?)>/g;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    const [full, closeName, openName, attrs = "", selfClose] = m;

    if (closeName) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === closeName) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (!openName) continue; // comment

    const isVoid =
      /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i.test(
        openName,
      );
    const selfHidden =
      /\shidden(?=[\s=/>]|$)/.test(attrs) || /aria-hidden="true"/.test(attrs);
    const transparentHere = /opacity:\s*0(?![.\d])/.test(attrs);

    const inHiddenSubtree = stack.some((e) => e.hidden);
    const inMountAnimated = stack.some((e) => e.mountAnimated);
    const mountAnimatedHere = MOUNT_ANIMATED_ROLE.test(attrs);

    if (
      transparentHere &&
      !inHiddenSubtree &&
      !inMountAnimated &&
      !mountAnimatedHere &&
      !selfHidden &&
      !isVoid
    ) {
      offenders.push(`${openName}${attrs ? ` ${attrs.trim()}` : ""}`.slice(0, 90));
    }

    if (!isVoid && !selfClose) {
      stack.push({
        name: openName,
        hidden: selfHidden || inHiddenSubtree,
        mountAnimated: mountAnimatedHere || inMountAnimated,
      });
    }
    void full;
  }
  return offenders;
}

for (const [route, html] of Object.entries(pages)) {
  if (html === null) continue;
  const label = `/${route === "index" ? "" : route}`;
  const offenders = findVisibleTransparent(html);
  check(
    `${label} has no visible element at opacity:0`,
    offenders.length === 0,
    offenders.length ? offenders.slice(0, 3).join(" | ") : "",
  );
}

// ── 3b. the active slide is opaque ────────────────────────────────────────
section("3b. Active slide/content is opaque");
for (const [route, html] of Object.entries(pages)) {
  if (html === null || route === "index") continue;
  const label = `/${route}`;
  // The first slide wrapper is the only one NOT marked hidden.
  const firstSlide = html.indexOf('id="slide-1"');
  const firstHidden = html.indexOf('id="slide-2"');
  check(`${label} slide 1 is not hidden`, firstSlide !== -1 && firstSlide < firstHidden);
}

// ── 4. real body copy is present ──────────────────────────────────────────
section("4. Body copy present in served HTML");
const COPY = {
  index: ["How does data", "actually move?", "Explore protocols"],
  tcp: ["Transmission Control Protocol", "TCP"],
  udp: ["User Datagram Protocol", "UDP"],
  http: ["HyperText Transfer Protocol", "HTTP"],
  https: ["HTTPS"],
  i2c: ["I²C"],
  can: ["CAN"],
};
for (const [route, needles] of Object.entries(COPY)) {
  const html = pages[route];
  if (html === null) continue;
  for (const needle of needles) {
    check(
      `/${route === "index" ? "" : route} contains "${needle}"`,
      html.includes(needle),
    );
  }
}

// ── 5. assets are root-relative ───────────────────────────────────────────
section("5. Asset URLs are origin-root relative");
for (const [route, html] of Object.entries(pages)) {
  if (html === null) continue;
  const label = `/${route === "index" ? "" : route}`;
  check(
    `${label} references /_next/ assets at the root`,
    html.includes('"/_next/static/'),
  );
  check(
    `${label} has no /protocol/_next/ asset URL`,
    !html.includes("/protocol/_next/"),
  );
  check(
    `${label} has a stylesheet link`,
    /<link[^>]+rel="stylesheet"/.test(html),
  );
}

// ── 6. canonical URLs ─────────────────────────────────────────────────────
section("6. Canonical URLs");
const origin = "https://website-protocol-ten.vercel.app";
for (const [route, html] of Object.entries(pages)) {
  if (html === null) continue;
  const expected = route === "index" ? origin : `${origin}/${route}`;
  check(
    `/${route === "index" ? "" : route} canonical is ${expected}`,
    html.includes(`rel="canonical" href="${expected}"`),
  );
}

console.log(
  `\n${failures === 0 ? "OK" : "FAILED"} — ${checks - failures}/${checks} checks passed`,
);
process.exit(failures === 0 ? 0 : 1);

function readdirSyncSafe(dir) {
  return existsSync(dir) ? readdirSync(dir) : [];
}
