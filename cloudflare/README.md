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

### Paths the Worker must NOT touch

| Incoming request | Handling |
|---|---|
| `GET /` | portfolio |
| `GET /about`, `/projects`, … | portfolio |
| `GET /_next/static/...` (no prefix) | portfolio's own assets |

Anything outside `/protocol` must fall through to the portfolio. If the Worker
claimed bare `/_next/*` it would collide with the portfolio's own bundles.

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
- `assets.run_worker_first: true` — required, so the Worker routes
  `/protocol*` before any static asset can shadow it.
- `assets.directory` — where the portfolio's files live for non-`/protocol`
  requests. Point it at your portfolio output.

### Point the domain at it

Add a route for `shriful.tech/protocol*` to the Worker. Requests outside that
pattern keep being served by whatever already handles the apex.

---

## 4. Tested behaviour

`cloudflare/test-worker.mjs` runs the Worker in plain Node against a stub
origin. No network, no credentials.

```bash
npm run test:worker
```

16 assertions, all passing:

| # | Assertion |
|---|---|
| 1 | `GET /protocol` → origin `/` |
| 2 | `GET /protocol/` → origin `/` |
| 3 | `GET /protocol/tcp` → origin `/tcp` |
| 4 | `GET /protocol/_next/...` → origin `/_next/...` |
| 5 | immutable caching on `/_next/static/` |
| 6 | query string preserved (`?_rsc=`) |
| 7 | `Host` header set to the origin's own host |
| 8 | non-`/protocol` served locally, origin never hit |
| 9 | `307 Location` → public host **and** prefix |
| 10 | origin-absolute `308 Location` → public host, origin hidden |
| 11 | external `302 Location` passed through untouched |
| 12 | origin 404 passes through as 404 |
| 13 | doubled prefix → 500 diagnostic |
| 14 | HTML/RSC `cache-control: must-revalidate` |
| 15 | origin identity headers (`x-vercel-id`, `server`) scrubbed |
| 16 | `PROTOCOL_PREFIX=/` disables the prefix cleanly |

> **What is and is not verified.** The Worker's routing logic, header handling
> and rewrite behaviour are verified by the suite above, and the Next.js build
> output is verified against the contract in §2. What has *not* been exercised
> is a live request from Cloudflare's edge through to the real Vercel
> deployment — that requires the domain route to be attached. Treat the edge leg
> as unverified until one real request through `shriful.tech/protocol` is
> observed.

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
| `cloudflare/wrangler.jsonc` | Worker config (`vars`, `assets`) |
| `cloudflare/test-worker.mjs` | behavioural test suite |
| `app/[id]/page.tsx` | protocol route — app-relative `/tcp`, not `/protocol/tcp` |
