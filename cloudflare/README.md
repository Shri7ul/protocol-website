# Deploying Protocol Atlas behind `shriful.tech/protocol`

How this app is published under a path prefix on the portfolio domain, and
exactly what the Cloudflare Worker is expected to do.

---

## 1. The shape

```
Browser                     Cloudflare Worker              Vercel
shriful.tech/protocol   ->  strip the prefix          ->   website-protocol.vercel.app/
shriful.tech/protocol/tcp -> strip the prefix         ->   website-protocol.vercel.app/tcp
shriful.tech/protocol/_next/... -> strip the prefix   ->   website-protocol.vercel.app/_next/...
shriful.tech/anything-else -> served by the portfolio, never proxied
```

The `/protocol` segment **stays in the browser address bar**. The Worker uses a
reverse proxy, not a redirect — nothing ever sends the visitor to the Vercel
hostname.

### Why `basePath` rather than Worker-only stripping

Next.js emits asset URLs root-absolute: `/_next/static/...`. With no `basePath`,
the browser resolves those against the apex domain — `shriful.tech/_next/...` —
which belongs to the portfolio. Every JS and CSS request would 404 or, worse,
silently load the portfolio's own chunks.

`basePath: "/protocol"` makes Next prefix *everything it generates* — asset
URLs, `<Link>` hrefs, router transitions, the RSC payload. The HTML is then
already correct for the browser and the Worker's only job is a single prefix
strip. No HTML or payload rewriting, which would be fragile against streaming
and edge caching.

### The route/shape invariant

```
public URL   = BASE_PATH + app-relative route
origin path  = app-relative route          (after the Worker strips)
```

That is why the dynamic segment lives at `app/[id]/` and **not**
`app/protocol/[id]/`. If the folder were named `protocol/`, the route would be
`/protocol/tcp` *and* the basePath would add another `/protocol`, producing
`/protocol/protocol/tcp`.

| Public URL | App route | Origin path |
|---|---|---|
| `shriful.tech/protocol` | `/` | `/` |
| `shriful.tech/protocol/tcp` | `/tcp` | `/tcp` |
| `shriful.tech/protocol/_next/static/x.js` | `/_next/static/x.js` | `/_next/static/x.js` |

---

## 2. How the app expects the Worker to route requests

This is the contract the build output actually emits. Every row was verified
against `.next/server/app/*.html` and `*.rsc`.

### Paths the Worker must strip and forward

| Incoming request | Origin path | Notes |
|---|---|---|
| `GET /protocol` | `/` | prefix root maps to app root |
| `GET /protocol/` | `/` | trailing slash collapses |
| `GET /protocol/tcp` | `/tcp` | protocol page |
| `GET /protocol/udp` … `/can` | `/udp` … `/can` | all six, SSG |
| `GET /protocol/_next/static/...` | `/_next/static/...` | content-hashed chunks |
| `GET /protocol/_next/static/css/...` | `/_next/static/css/...` | stylesheet |
| `GET /protocol/favicon.ico` | `/favicon.ico` | static metadata files |
| `GET /protocol/tcp?_rsc=abc` | `/tcp?_rsc=abc` | **client router fetch** |

The rule is total — everything under `/protocol` is forwarded with the prefix
removed. There is no per-asset special-casing, because a single prefix strip
covers every case.

### Paths the Worker should not handle

| Incoming request | Handling |
|---|---|
| `GET /` | portfolio — normally never routed to this Worker |
| `GET /about`, `/projects`, … | portfolio — normally never routed to this Worker |
| `GET /_next/static/...` (no prefix) | portfolio's own assets |

In production these never reach the Worker: the route is `/protocol*` only. The
Worker still handles them safely if invoked directly — see
*Requests outside `/protocol`* below. It must never claim bare `/_next/*`, or it
would collide with the portfolio's own bundles.

### The browser only ever requests prefixed URLs

Verified from the emitted HTML:

```
href="/protocol"                      href="/protocol/tcp"
href="/protocol#compare"              href="/protocol/udp"
href="/protocol#foundations"          href="/protocol/http"
src="/protocol/_next/static/chunks/…" href="/protocol/i2c"
href="/protocol/_next/static/css/…"   href="/protocol/can"
```

Count of root-absolute `/_next/` references (i.e. leaks to the portfolio
namespace): **0**.

### The client router uses app-relative paths

From `tcp.rsc`, the payload the client router consumes:

```json
"p": "/protocol"          // the router's basePath
"c": ["", "tcp"]          // route segments — APP-RELATIVE
"b": "kcqALDSdI69LYlLUsHmPB"
asset refs: "static/chunks/app/[id]/page-….js"   // no leading slash
```

Two things follow, and both matter:

1. `"c"` is `["", "tcp"]`, **not** `["", "protocol", "tcp"]`. The router is
   app-relative internally and applies `"p"` itself, so client-side navigation
   produces `/protocol/tcp` in the bar — never a bare `/tcp`.
2. Asset refs have **no leading slash**. The client joins them onto `"p"`, so
   the resulting request is `/protocol/_next/...` — which is exactly the prefix
   the Worker strips. The origin is asked for `/_next/...`.

The origin path is never prefixed. If the Worker sees a path that *still*
contains `/protocol` after stripping, the app was built without `basePath`; the
Worker returns a 500 with a diagnostic rather than silently 404ing.

### Requests outside `/protocol` — who serves them?

**In production: not this Worker.** The Worker is routed to
`shriful.tech/protocol*` only, so a portfolio request is never delivered to it.
That is the design, not an omission — this Worker is a pure reverse proxy and
never serves the portfolio itself.

That distinction matters because the Worker can also be reached at its
**preview URL**, `https://protocol.smislam5959.workers.dev/`, which receives
*every* path. A bare visit there is outside the prefix, so the Worker has to
decide what to do. It resolves in this order:

| Condition | Behaviour |
|---|---|
| `env.ASSETS` binding exists | serve the bundled portfolio from the edge |
| `PORTFOLIO_ORIGIN` is set | reverse-proxy to that origin |
| neither | return an explanatory page (200, `no-store`) |

The third case is a real, correct state. It never throws and never loops.

#### The bug this replaced

An earlier revision declared `assets.binding: "ASSETS"` in `wrangler.jsonc`
while `worker.js` called `env.ASSETS.fetch(request)` unconditionally. The
production Worker has no such binding, so any non-prefixed request raised:

```
TypeError: Cannot read properties of undefined (reading 'fetch')
```

Two rules follow, and both are now enforced by tests:

1. **Never assume a binding exists.** Check it:
   `if (env.ASSETS && typeof env.ASSETS.fetch === "function")`.
2. **Never use `fetch(request)` as a fallback.** It re-issues the request to the
   same URL; on workers.dev that is the same Worker, so it re-enters `fetch`
   until the runtime kills it. All fallbacks now construct an explicit target
   URL.

`wrangler.jsonc` no longer declares an `assets` block, because this Worker does
not serve static assets. Config and code now agree.

---

## 3. Setup

### Build the app

`NEXT_PUBLIC_BASE_PATH` is the single knob. Unset in production it defaults to
`/protocol`; unset in development it defaults to `""`.

```bash
npm run build          # production: bakes in /protocol
```

To deploy at the root instead (no prefix):

```bash
NEXT_PUBLIC_BASE_PATH="" npm run build
```

Optionally set the public origin, used for canonical URLs and metadata:

```bash
NEXT_PUBLIC_SITE_ORIGIN=https://shriful.tech
```

Both are read at build time — `basePath` cannot be changed at runtime, and the
Worker's `PROTOCOL_PREFIX` must match whatever the build used.

### Deploy the Worker

```bash
cd cloudflare
npx wrangler deploy
```

Config lives in `cloudflare/wrangler.jsonc`:

- `PROTOCOL_PREFIX` — must equal the build's `NEXT_PUBLIC_BASE_PATH`.
- `PROTOCOL_ORIGIN` — the Vercel deployment, **without** the prefix.
- `PORTFOLIO_ORIGIN` — **leave unset in production.** It is only needed if you
  want the workers.dev preview URL to proxy non-`/protocol` paths. There is no
  default, deliberately: a guessed portfolio origin would silently send a
  visitor somewhere you never configured.
- **No `assets` block.** This Worker serves nothing itself.

### Point the domain at it

Add a route for `shriful.tech/protocol*` to the Worker. Requests outside that
pattern keep being served by whatever already handles the apex.

---

## 4. Testing the deployed Worker

### 4a. Test through the real domain, not the preview root

This is the important one. The preview URL and the production URL exercise
**different code paths**, so a passing preview root proves very little.

| URL | What it reaches |
|---|---|
| `https://protocol.smislam5959.workers.dev/protocol/tcp` | reverse-proxy branch |
| `https://protocol.smislam5959.workers.dev/` | non-prefix branch (preview only) |
| `https://shriful.tech/protocol/tcp` | reverse-proxy branch — **this is production** |

The bare preview root hits the non-prefix branch. That branch is *never
reachable* on `shriful.tech`, because the route only sends `/protocol*` to the
Worker. So:

- **Do not** treat `https://…workers.dev/` working as evidence production works.
- **Do** test every path you care about under the prefix, on both origins.

#### The checks that matter

Run these against the real domain. `-I` sends `HEAD`, so you get status and
headers without a body; drop it to inspect HTML.

```bash
# 1. The app root — expect 200 and the Protocol Atlas HTML.
curl -sI https://shriful.tech/protocol | head -5

# 2. Every protocol page — expect 200 each, not 404.
for p in tcp udp http https i2c can; do
  printf '%-6s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' https://shriful.tech/protocol/$p)"
done

# 3. Assets — must NOT be the portfolio's. Expect 200 + a JS content type.
curl -sI "$(curl -s https://shriful.tech/protocol \
  | grep -o '/protocol/_next/static/[^"]*\.js' | head -1 \
  | sed 's|^|https://shriful.tech|')" | head -5
```

#### The checks that catch the real failure modes

```bash
# 4. The prefix must NOT be doubled in any served URL.
curl -s https://shriful.tech/protocol | grep -c '/protocol/protocol'

# 5. Assets must not resolve to your portfolio's namespace.
#    A non-zero count means basePath was lost in the build.
curl -s https://shriful.tech/protocol | grep -c 'href="/_next/'

# 6. The Vercel hostname must never appear in a response.
curl -sI https://shriful.tech/protocol | grep -i 'vercel'

# 7. Redirects must stay on the public host.
curl -sI https://shriful.tech/protocol/tcp | grep -i '^location'
```

Expected: `0`, `0`, no output, and either no `Location` or one beginning
`https://shriful.tech/protocol`.

#### Then check it in a browser, not just with curl

`curl` proves the server half. These three only fail in a browser:

1. **Reload works.** Open `https://shriful.tech/protocol/tcp` directly (paste
   the URL, do not navigate to it) and press `Ctrl+Shift+R`. A 404 here means
   the Worker strip or the build's `basePath` is wrong.
2. **Client-side navigation keeps the prefix.** From `/protocol`, click through
   to TCP, then UDP. The address bar must read `/protocol/udp` — never
   `/udp`.
3. **Assets actually load.** Open DevTools → Network, reload, filter by JS. Every
   request must be `/protocol/_next/...`. Any request to `/_next/...` at the
   apex is being served by your portfolio and the page will break subtly.

#### If the preview URL must not error

With no `PORTFOLIO_ORIGIN` set, `https://protocol.smislam5959.workers.dev/`
returns a **200** explanatory page rather than a `TypeError`. That is the
desired outcome for a preview origin. If you would rather it proxy your
portfolio, set `PORTFOLIO_ORIGIN` and redeploy.

### 4b. The local suites

Both run the Worker in plain Node against stub origins. No network, no
credentials, no Cloudflare account.

```bash
npm run test:worker      # 26 behavioural assertions
npm run test:contract    # 9 production routing rows
```

`test-contract.mjs` transcribes the deployment requirement row by row, so the
contract cannot drift silently:

```
/protocol                  -> /
/protocol/tcp              -> /tcp
/protocol/udp              -> /udp
/protocol/http             -> /http
/protocol/https            -> /https
/protocol/i2c              -> /i2c
/protocol/can              -> /can
/protocol/_next/static/... -> /_next/static/...
```

`test-worker.mjs` covers the behavioural surface, including the regression that
caused the reported `TypeError`:

| Group | Assertions |
|---|---|
| prefix stripping | `/protocol`, `/protocol/`, `/protocol/tcp`, `/protocol/_next/...` |
| caching | `immutable` on `/_next/static/`, `must-revalidate` on HTML |
| headers | `Host` rewrite, origin identity scrubbed |
| redirects | site-absolute, origin-absolute, external |
| errors | origin 404 passthrough, doubled prefix → 500 diagnostic |
| **no `ASSETS` binding** | `/about` does not throw; falls back to `PORTFOLIO_ORIGIN` |
| **preview URL** | `/` does not throw, is not a recursion loop, names the working URLs |
| **preview + prefix** | `/protocol/tcp` still reverse-proxies correctly |
| config | `PROTOCOL_PREFIX=/` disables the prefix |

> **What is and is not verified.** The Worker's routing, header handling,
> rewrite behaviour and binding-absence handling are verified by the suites
> above; the Next.js build output is verified against §2. What has **not** been
> exercised is a live request from Cloudflare's edge to the real Vercel
> deployment — that needs the domain route attached. Do not call the deployment
> verified until you have run the §4a checks and seen them pass.

---

## 5. Why the Worker sets `Host` to the origin

Vercel routes on the `Host` header. Forwarding the proxy's host
(`shriful.tech`) can make Vercel answer with its "no such deployment" page, so
the Worker rewrites `Host` to the origin's own hostname and instead records the
visitor-facing values in `x-forwarded-host`, `x-forwarded-proto`,
`x-forwarded-prefix` and `x-original-path`.

It also deletes `cf-*` headers before forwarding, and strips `x-vercel-id`,
`x-vercel-cache` and `server` from the response so the origin stays invisible.

---

## 6. Files

| File | Role |
|---|---|
| `next.config.ts` | resolves `basePath` from `NEXT_PUBLIC_BASE_PATH` |
| `src/lib/deployment.ts` | `BASE_PATH`, `SITE_ORIGIN`, `SITE_URL`, `stripBasePath()` |
| `cloudflare/worker.js` | the reverse proxy |
| `cloudflare/wrangler.jsonc` | Worker config (`vars` only — no `assets`) |
| `cloudflare/test-worker.mjs` | behavioural suite, 26 assertions |
| `cloudflare/test-contract.mjs` | production routing table, 9 rows |
| `app/[id]/page.tsx` | protocol route — app-relative `/tcp`, not `/protocol/tcp` |
