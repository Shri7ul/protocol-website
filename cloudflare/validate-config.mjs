/**
 * Validate `wrangler.jsonc` — the file is JSON-with-comments, so nothing in the
 * toolchain catches a typo until `wrangler deploy` fails, often late and with an
 * unhelpful message.
 *
 * This strips `//` line comments and parses, then asserts the handful of
 * invariants that are easy to break and expensive to discover in production:
 *
 *   1. The route pattern is bound to the APEX host, not `www`.
 *      Both hosts resolve through Cloudflare and both are proxied to Vercel,
 *      whose "redirect apex to www" setting answers every apex path with a 307.
 *      If the Worker's pattern also (or only) matched `www`, the request would
 *      be answered by the portfolio project there — which has no `/protocol`
 *      route — and the Worker would never run.
 *
 *   2. `PROTOCOL_ORIGIN_KEEPS_PREFIX` agrees with the configured origin.
 *      The real origin serves the app UNDER `/protocol` (`/protocol/tcp` 200,
 *      `/tcp` 404), so this must be truthy. Getting it wrong sends `/tcp`
 *      upstream and every route 404s.
 *
 *   3. No `assets` block.
 *      This Worker is a pure reverse proxy. Declaring an `assets` binding is
 *      what previously produced `TypeError: Cannot read properties of
 *      undefined (reading 'fetch')` on the workers.dev preview URL.
 *
 *   4. The prefix agrees with the Next.js build contract.
 *
 *   node cloudflare/validate-config.mjs
 *
 * Read-only. No network.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass: Boolean(pass), detail });

/**
 * Strip `//` line comments and `/* ... *\/` block comments, but not comment
 * markers that appear inside a string literal.
 *
 * `wrangler.jsonc` opens with a `/** ... *\/` banner, so block comments have to
 * be handled — stripping only line comments leaves the file unparseable.
 */
function stripComments(source) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (!inString && ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (!inString && ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i++;
      // Preserve the line break so line numbers stay roughly aligned.
      out += "\n";
      continue;
    }
    out += ch;
  }
  return out;
}

let cfg;
try {
  cfg = JSON.parse(stripComments(readFileSync(join(here, "wrangler.jsonc"), "utf8")));
  check("wrangler.jsonc parses as JSONC", true);
} catch (error) {
  check("wrangler.jsonc parses as JSONC", false, error.message);
}

if (cfg) {
  // 1 — route shape
  const routes = cfg.routes ?? [];
  const patterns = routes.map((r) => r.pattern ?? "");
  check(
    "declares a route pattern",
    patterns.length > 0,
    `routes=${JSON.stringify(routes)}`,
  );
  const apexPattern = patterns.find((p) => p.startsWith("shriful.tech/protocol"));
  check(
    "route is bound to the APEX host (shriful.tech/protocol*)",
    Boolean(apexPattern),
    `patterns=${JSON.stringify(patterns)} — must start with "shriful.tech/protocol"`,
  );
  check(
    "route does NOT target the www host",
    !patterns.some((p) => p.includes("www.")),
    `patterns=${JSON.stringify(patterns)} — a www match is answered by the portfolio, not this Worker`,
  );
  check(
    "route zone matches the host",
    routes.every((r) => !r.zone_name || r.pattern.startsWith(`${r.zone_name}/`)),
    `routes=${JSON.stringify(routes)}`,
  );

  // 2 — origin agreement
  const vars = cfg.vars ?? {};
  const origin = vars.PROTOCOL_ORIGIN ?? "";
  const keepsRaw = String(vars.PROTOCOL_ORIGIN_KEEPS_PREFIX ?? "").toLowerCase();
  const keeps = keepsRaw === "true" || keepsRaw === "1" || keepsRaw === "yes";
  check(
    "PROTOCOL_ORIGIN is set and absolute",
    /^https?:\/\/[^/]+$/.test(origin),
    `PROTOCOL_ORIGIN=${JSON.stringify(vars.PROTOCOL_ORIGIN)}`,
  );
  check(
    "PROTOCOL_ORIGIN points at the app deployment, not the portfolio",
    !/^(https?:\/\/)?(www\.)?shriful\.tech\/?$/.test(origin) &&
      !origin.includes("shriful.tech"),
    `PROTOCOL_ORIGIN=${origin} — pointing at shriful.tech would recurse through the front door`,
  );
  check(
    "PROTOCOL_ORIGIN_KEEPS_PREFIX is true",
    keeps,
    `got ${JSON.stringify(vars.PROTOCOL_ORIGIN_KEEPS_PREFIX)} — the real origin serves /protocol/tcp (200) and 404s /tcp, so the prefix must be KEPT`,
  );

  // 3 — no assets binding
  check(
    "no assets block (pure reverse proxy)",
    !("assets" in cfg),
    "an assets binding is what produced the TypeError on the preview URL",
  );

  // 4 — prefix vs build contract
  const prefix = vars.PROTOCOL_PREFIX;
  check(
    "PROTOCOL_PREFIX is a single leading-slash segment",
    typeof prefix === "string" && /^\/[^/]+$/.test(prefix),
    `PROTOCOL_PREFIX=${JSON.stringify(prefix)}`,
  );
  try {
    const deployTs = readFileSync(join(here, "..", "src", "lib", "deployment.ts"), "utf8");

    // `BASE_PATH` is `normalisePrefix(process.env.NEXT_PUBLIC_BASE_PATH)`, and
    // `normalisePrefix` returns this literal when the env var is unset in a
    // production build. That default is what the deployed app actually uses,
    // so it is the value the Worker must agree with.
    const productionDefault = (deployTs.match(
      /NODE_ENV\s*===\s*["']production["']\s*\?\s*["'](\/[^"']*)["']/,
    ) ?? [])[1];

    // A pinned NEXT_PUBLIC_BASE_PATH in the Vercel project would override the
    // default; treat that as the contract if present.
    const envPin = (deployTs.match(
      /NEXT_PUBLIC_BASE_PATH\s*[:=][^;]*?["'](\/[^"']*)["']/,
    ) ?? [])[1];

    const contract = envPin ?? productionDefault;

    check(
      "src/lib/deployment.ts exposes a production prefix default",
      Boolean(productionDefault),
      "could not find the NODE_ENV === 'production' ? '<prefix>' default",
    );
    check(
      `PROTOCOL_PREFIX matches the build contract (${contract ?? "?"})`,
      Boolean(contract) && contract === prefix,
      `wrangler=${JSON.stringify(prefix)} vs deployment.ts=${JSON.stringify(contract)}`,
    );
  } catch (error) {
    check("src/lib/deployment.ts readable", false, error.message);
  }

  check("main entrypoint is worker.js", cfg.main === "worker.js", `main=${cfg.main}`);
}

console.log("\n=== wrangler config check ===\n");
let passed = 0;
for (const t of results) {
  console.log(`${t.pass ? "PASS" : "FAIL"}   ${t.name}${t.pass ? "" : `\n       -> ${t.detail}`}`);
  if (t.pass) passed++;
}
console.log(`\n${passed}/${results.length} config assertions passed\n`);
process.exit(passed === results.length ? 0 : 1);
