# Deploying Protocol Atlas behind `shriful.tech/protocol`

How this app is published under a path prefix on the portfolio domain, and
exactly what the Cloudflare Worker is expected to do.

---

## 1. The shape

There are **two addresses** for one app, and keeping them distinct is the whole
design:

| Address | Serves | Prefix |
|---|---|---|
| `https://website-protocol-ten.vercel.app/` | the deployment itself | **none** |
| `https://shriful.tech/protocol` | the public portfolio URL | `/protocol` |

```
ORIGIN  (Vercel/Netlify)                  PUBLIC  (portfolio domain)
  /          -> app root      200           /protocol      -> app root     200
  /tcp       -> TCP page      200           /protocol/tcp  -> TCP page     200
  /_next/... -> assets        200           /protocol/_next/... -> assets  200
  /protocol  -> 404 (not here)              /              -> the portfolio
```

**The app is built at its own ROOT — `basePath` is unset.** So opening the
deployment URL directly just works: `/` is the app, no proxy, no prefix. The
`/protocol` segment exists **only** on the portfolio domain, where the Cloudflare
Worker adds it and strips it again on the way in.

### Why the two are separate

An earlier revision set `basePath: "/protocol"`, which mounted the app under the
prefix **on its own origin too**. The deployment then 404'd at `/` — that is the
"deployed but the link shows nothing" symptom — and the prefix had to be kept,
so the origin could never be opened directly.

Now:

```
basePath            = ""            where the app mounts on ITS OWN origin
PUBLIC_PATH_PREFIX  = "/protocol"   where it appears on the PORTFOLIO
```

`PUBLIC_PATH_PREFIX` is **metadata only** (canonical and Open Graph URLs). It
never reaches asset paths or in-app `href`s — those are origin-root relative, so
the same build works on any host. `app/layout.tsx` uses it for `canonical`, and
`app/[id]/page.tsx` extends it per page.

### Does the Worker strip the prefix? It depends on the origin

```
Browser                     Cloudflare Worker              Vercel
shriful.tech/protocol   ->  forward unchanged         ->   website-protocol-ten.vercel.app/protocol
shriful.tech/protocol/tcp -> forward unchanged        ->   website-protocol-ten.vercel.app/protocol/tcp
shriful.tech/protocol/_next/... -> forward unchanged  ->   website-protocol-ten.vercel.app/protocol/_next/...
shriful.tech/anything-else -> not routed to this Worker
```

The `/protocol` segment **stays in the browser address bar**. The Worker uses a
reverse proxy, not a redirect — nothing ever sends the visitor to the Vercel
hostname.

> **The origin hostname is `-ten`.** `website-protocol.vercel.app` (without the
> suffix) serves a *different* project — "RADAR - AI Governance Evidence |
> AKIOUD AI" — and 404s on `/protocol/_next/...`. The `-ten` form is Vercel's
> name-suffix disambiguator for the project literally named
> `website-protocol`. Confusing the two produces 404s everywhere; see
> *Choosing the origin* below.

### Does the Worker strip the prefix? It depends on the origin

| Origin serves | `PROTOCOL_ORIGIN_KEEPS_PREFIX` | Worker maps `/protocol/tcp` to |
|---|---|---|
| `/tcp` (app built without `basePath`) | `"false"` — **production** | `/tcp` — strips |
| `/protocol/tcp` (app built with `basePath`) | `"true"` | `/protocol/tcp` — unchanged |

`website-protocol-ten.vercel.app` is the **first** kind now: the app is built
without `basePath`, so `/` and `/tcp` are 200 and `/protocol` is 404. Production
therefore sets the flag to `"false"`.

Both settings produce valid-looking URLs; only one matches the origin. Getting it
wrong yields a wall of 404s with no other symptom, so **ask the origin** rather
than guessing — and ask for both shapes, because a 200 on one tells you which
flag is right:

```bash
curl -s -o /dev/null -w '/ %{http_code}\n'          https://<origin>/
curl -s -o /dev/null -w '/tcp %{http_code}\n'       https://<origin>/tcp
curl -s -o /dev/null -w '/protocol %{http_code}\n'  https://<origin>/protocol
```

`/` → 200 and `/protocol` → 404 means `KEEPS_PREFIX=false` (strip). The inverse
means `true`.

> **The flag must agree with the build.** `cloudflare/validate-config.mjs`
> (`npm run test:config`) reads `basePath` from `next.config.ts` and asserts the
> pairing, so the two cannot drift apart unnoticed.

### Choosing the origin

```bash
# 200 at "/" -> Protocol Atlas (root mount). 404 -> not our app or still prefixed.
for h in website-protocol.vercel.app website-protocol-ten.vercel.app; do
  printf '%-42s %s  %s\n' "$h" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://$h/)" \
    "$(curl -s https://$h/ | grep -o '<title>[^<]*' | head -1)"
done
```

`npm run test:live` automates exactly this against the configured origin.

### Why no `basePath`, and what does the prefixing now

Next emits asset URLs root-absolute (`/_next/static/...`), and with `basePath`
unset that is exactly what we want: the origin serves those paths itself, so the
browser resolves them against the origin. Nothing breaks and the deployment works
standalone.

The prefix problem is solved **by the proxy instead**: every request under
`/protocol` is forwarded with that one segment removed. Because the app is
mounted at the root, the strip is a total, single-rule mapping — pages, RSC
payloads, and assets all transform identically. There is no per-asset
special-casing and no HTML or payload rewriting (which would be fragile against
streaming and edge caching).

The trade-off: the Worker is now **required** for the public URL, whereas before
the origin already carried the prefix. That is the correct trade — it is what
makes the deployment directly openable, which is the point.

### The route/shape invariant

```
origin path  = app-relative route            <- the app is mounted at the ROOT
public URL   = PUBLIC_PATH_PREFIX + origin path
```

Because `basePath` is empty, the app-relative route **is** the origin path. The
dynamic segment lives at `app/[id]/`, giving `/tcp` — which the origin serves
directly and the Worker maps `/protocol/tcp` onto.

| Public URL | App route | Origin path |
|---|---|---|
| `shriful.tech/protocol` | `/` | `/` |
| `shriful.tech/protocol/tcp` | `/tcp` | `/tcp` |
| `shriful.tech/protocol/_next/static/x.js` | `/_next/static/x.js` | `/_next/static/x.js` |
| `website-protocol-ten.vercel.app/` | `/` | (direct, no proxy) |

Naming the folder `protocol/` would not double anything now that `basePath` is
empty, but it would collide again the moment `basePath` is reintroduced, so
`app/[id]/` stays.

---

## 2. How the app expects the Worker to route requests

This is the contract the build output actually emits. Every row was verified
against `.next/server/app/*.html` and `*.rsc`.

### Paths the Worker forwards

Production uses `PROTOCOL_ORIGIN_KEEPS_PREFIX=false` (the app is root-mounted),
so the prefix is **stripped**. The keeps-prefix variant is shown alongside for
completeness.

| Incoming request | Origin path (strips) | Origin path (keeps prefix) | Notes |
|---|---|---|---|
| `GET /protocol` | `/` | `/protocol` | app root |
| `GET /protocol/` | `/` | `/protocol` | trailing slash collapses |
| `GET /protocol/tcp` | `/tcp` | `/protocol/tcp` | protocol page |
| `GET /protocol/udp` … `/can` | `/udp` … | `/protocol/udp` … | all six, SSG |
| `GET /protocol/_next/static/...` | `/_next/static/...` | `/protocol/_next/static/...` | content-hashed chunks |
| `GET /protocol/_next/static/css/...` | `/_next/static/css/...` | `/protocol/_next/static/css/...` | stylesheet |
| `GET /protocol/favicon.ico` | `/favicon.ico` | `/protocol/favicon.ico` | static metadata |
| `GET /protocol/tcp?_rsc=abc` | `/tcp?_rsc=abc` | `/protocol/tcp?_rsc=abc` | **client router fetch** |

The rule is total — everything under `/protocol` is forwarded, with or without
the prefix depending on the origin's shape. There is no per-asset
special-casing.

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

### The browser requests ROOT-relative URLs

Verified from the emitted HTML (`basePath` is unset):

```
href="/tcp"                      href="/udp"
href="/#compare"                 href="/http"
href="/#foundations"             href="/i2c"
src="/_next/static/chunks/…"     href="/_next/static/css/…"
href="/can"
```

Count of `/protocol/`-prefixed references: **0**. That is correct and deliberate
— the app does not know it is published under a prefix. On the portfolio domain
the browser still ends up requesting `/protocol/...`, because **the visitor
arrived at `/protocol/tcp` and root-relative links resolve against the
`/protocol` base of the current path.** That is precisely why a single strip rule
is sufficient: the proxy adds the prefix on the way out and removes it on the way
in.

### The client router uses root-relative paths

From `tcp.rsc`, the payload the client router consumes:

```json
"c": ["", "tcp"]          // route segments — app-relative
asset refs: "/_next/static/css/….css"   // root-absolute
```

There is **no `"p"` (basePath) field**, because `basePath` is unset. Two things
follow:

1. `"c"` is `["", "tcp"]` — the app-relative route, which is also the origin
   path. On the portfolio the browser requests `/protocol/tcp` and the Worker
   strips to `/tcp`.
2. Asset refs are root-absolute, so they resolve against the current mount point
   in the browser and the Worker strips them the same way. One rule, applied
   uniformly.

`cloudflare/check-root-nav.mjs` (`npm run test:root`) asserts exactly this
against a running server: documents, assets, the RSC payload, and that the prefix
does **not** exist on the origin.

The origin path is never prefixed. If the Worker sees a path that *still* contains
`/protocol` after stripping, the app was built *with* `basePath` while the Worker
is stripping; the Worker returns a 500 with a diagnostic rather than silently
404ing.

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

- `PROTOCOL_PREFIX` — the public prefix. Must equal the deployment's
  `NEXT_PUBLIC_PUBLIC_PATH_PREFIX`.
- `PROTOCOL_ORIGIN` — the deployment serving the app. Production:
  `https://website-protocol-ten.vercel.app` (note `-ten`).
- `PROTOCOL_ORIGIN_KEEPS_PREFIX` — `"false"` for this origin, because the app is
  built without `basePath` and therefore serves at its own root. See *Choosing
  the origin* above for the `curl` method that decides it.
- `PORTFOLIO_ORIGIN` — **leave unset in production.** It is only needed if you
  want the workers.dev preview URL to proxy non-`/protocol` paths. There is no
  default, deliberately: a guessed portfolio origin would silently send a
  visitor somewhere you never configured.
- `routes` — `shriful.tech/protocol*`.
- **No `assets` block.** This Worker serves nothing itself.

Run `npm run test:config` after editing this file. It parses the config and
asserts the invariants above — including that the route is on the **apex** host
and not `www`, and that `KEEPS_PREFIX` agrees with `basePath` in
`next.config.ts`.

### Point the domain at it

`wrangler.jsonc` already declares the route:

```jsonc
"routes": [{ "pattern": "shriful.tech/protocol*", "zone_name": "shriful.tech" }]
```

Requests outside that pattern keep being served by whatever already handles the
apex.

#### Which host does the route belong on? (measured 2026-10-03)

**The apex — and this is load-bearing.** Both `shriful.tech` and
`www.shriful.tech` resolve through Cloudflare, and **both are proxied to
Vercel**. The portfolio project has *redirect apex to www* enabled, so Vercel
answers every apex request with `307 -> https://www.shriful.tech/<same path>`:

| Host + path | Status | Location |
|---|---|---|
| `shriful.tech/protocol` | 307 | `https://www.shriful.tech/protocol` |
| `shriful.tech/protocol/tcp` | 307 | `https://www.shriful.tech/protocol/tcp` |
| `www.shriful.tech/protocol` | 404 | — (portfolio, no `/protocol` route) |

Two consequences:

1. **A route on `www.shriful.tech/protocol*` would never run.** The request is
   answered by the portfolio project on that host, which has no `/protocol`
   route, so the Worker would not be reached.
2. **The apex route only helps if the browser stays on the apex.** With
   apex→`www` on, the browser is sent to `www` before the Worker can answer.
   Turn that redirect off (or point `www` back at the apex) — see
   `DEPLOY-WORKFLOW.md`, Stage 2.3.

The 307 is Vercel's, not Cloudflare's: it carries `x-vercel-id` and
`Content-Type: text/plain`, which a Cloudflare redirect rule would not produce.
An earlier revision of this file blamed a **Netlify** rule for the `/protocol`
behaviour; re-measuring every host shows no `x-nf-request-id` anywhere, so that
attribution was wrong and has been removed.

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
npm run test:worker      # 34 behavioural assertions
npm run test:contract    # 13 routing rows, both origin shapes
npm run test:config      # 13 wrangler.jsonc invariants (route host, origin flags)
npm run test:live        # 13 assertions against the REAL origin (uses network)

npm test                 # all of the above, in order
npm run test:public      # the PUBLIC URL — needs the route deployed + apex fixed
```

`test-live-origin.mjs` is the one that validates the deployment decision rather
than the code: it fetches the configured origin directly and asserts the app is
reachable under the prefix *and unreachable without it* — which is what makes
`PROTOCOL_ORIGIN_KEEPS_PREFIX=true` mandatory instead of merely plausible.

`test-contract.mjs` transcribes the routing requirement row by row in **both**
modes, so neither shape can drift silently:

```
-- keeps prefix --                    -- strips prefix --
/protocol                  -> /protocol   /protocol                  -> /
/protocol/tcp              -> /protocol/tcp   /protocol/tcp              -> /tcp
/protocol/_next/static/... -> /protocol/_next/static/...   /protocol/_next/static/... -> /_next/static/...
```

`test-worker.mjs` covers the behavioural surface, including the regressions that
caused the two reported failures:

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
| **keeps prefix** | root/page/asset mapping, caching, query, no false 500 |
| config | `PROTOCOL_PREFIX=/` disables the prefix |

> **What is and is not verified.** The Worker's routing, header handling,
> rewrite behaviour, binding-absence handling and prefix-keeping are verified by
> the suites above; the build output is verified against §2; and
> `npm run test:live` confirms the configured origin serves the app under the
> prefix. What has **not** been exercised is a request through Cloudflare's edge
> to the real origin — that needs the `shriful.tech/protocol*` route attached
> and a deployed Worker. Do not call the deployment verified until you have run
> the §4a checks and seen them pass.
>
> **Current public-route status: failing, as expected (2026-10-03).**
> `npm run test:public` is at **1/8**. Every page 307-redirects from the apex to
> `www.shriful.tech`, which has no `/protocol` route, so it 404s. The one passing
> assertion is `resolves without looping` — a finite redirect, not a loop.
> Two things must both happen before it can pass:
>
> 1. `cd cloudflare && npx wrangler deploy` (attaches the `shriful.tech/protocol*` route)
> 2. Turn off *redirect apex to www* on the Vercel portfolio project
>
> Neither has been done; this document does not claim otherwise.

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
| `cloudflare/test-worker.mjs` | behavioural suite, 34 assertions |
| `cloudflare/test-contract.mjs` | routing table, both origin shapes |
| `cloudflare/test-live-origin.mjs` | validates the configured origin over the network |
| `app/[id]/page.tsx` | protocol route — app-relative `/tcp`, not `/protocol/tcp` |
