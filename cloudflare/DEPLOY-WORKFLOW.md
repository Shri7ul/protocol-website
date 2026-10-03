# Deploy workflow — Vercel first, then `shriful.tech/protocol`

Two independent stages. Stage 1 must be green before Stage 2 means anything,
because Stage 2 is a proxy: if the origin is broken, the proxy faithfully
proxies a broken site.

```
STAGE 1  Next.js  ->  Vercel/Netlify            (the app, at its OWN ROOT)
STAGE 2  shriful.tech/protocol  ->  proxy  ->  Vercel   (the public address)
```

**The app is built at its own root.** Stage 1 is directly openable at `/` — no
prefix, no proxy. The `/protocol` segment is added only in Stage 2. Keeping those
separate is what makes the deployment verifiable on its own.

---

## Stage 1 — Deploy the app to Vercel

### 1.1 Build locally and confirm the shape

```bash
cd /d/website/protocol-website
npm run build
```

The build must emit **root-relative** asset URLs. Verify before deploying:

```bash
grep -oE '(src|href)="/_next/[^"]*"' .next/server/app/index.html | head -3
grep -c 'href="/protocol/' .next/server/app/index.html    # must be 0
```

If the first exits non-zero or the second is non-zero, the build has `basePath`
set — unset `NEXT_PUBLIC_BASE_PATH` in the Vercel project and rebuild.

### 1.2 Push to the branch Vercel tracks

Vercel's project is `website-protocol`, and its production domain is:

```
https://website-protocol-ten.vercel.app
```

Note the **`-ten`** suffix — Vercel appends it when the bare project name is
taken. The bare `website-protocol.vercel.app` is a *different* project (it
serves "RADAR - AI Governance Evidence"). Always verify by title, never by
name:

```bash
curl -s https://website-protocol-ten.vercel.app/ | grep -o '<title>[^<]*'
# expect: <title>Protocol Atlas — How data actually moves
```

### 1.3 Verify on Vercel BEFORE touching Cloudflare

```bash
for p in "" /tcp /udp /http /https /i2c /can; do
  printf '  %-6s %s\n' "${p:-/}" \
    "$(curl -s -o /dev/null -w '%{http_code}' \
       "https://website-protocol-ten.vercel.app$p")"
done
```

All seven must be **200** — including the root. `npm run test:live` automates
this and also asserts the prefix is *absent* here.

### 1.4 `/` must now work — and `/protocol` must NOT

`https://website-protocol-ten.vercel.app/` returns **200**. That is the point of
building without `basePath`.

`https://website-protocol-ten.vercel.app/protocol` returns **404**. That is also
correct: the prefix belongs to the proxy, not to the deployment. If it returns
200 here, the build still has `basePath` set — see 1.1.

> The Vercel dashboard's preview panel loads the deployment root, so it now
> renders the app correctly rather than "The page could not be found".

### Stage 1 checklist

| # | Check | Command | Expect |
|---|---|---|---|
| 1 | Root-relative assets | `grep -oE '/_next/' .next/server/app/index.html \| head -1` | a match |
| 2 | No prefixed hrefs | `grep -c 'href="/protocol/' .next/server/app/index.html` | `0` |
| 3 | **Root serves the app** | `curl -o /dev/null -w '%{http_code}' <origin>/` | `200` |
| 4 | All pages up | curl loop in 1.3 | seven × `200` |
| 5 | Prefix absent | `npm run test:live` | 13/13 |

---

## Stage 2 — Publish at `shriful.tech/protocol`

Stage 2 has exactly one job: make `/protocol` reachable on the portfolio domain
**without** the address bar ever showing the Vercel host.

### 2.1 Know which proxy you are using

There are two mechanisms that can front `/protocol`. **Only one should be
active** — if both are configured they will fight.

| Mechanism | Where it is configured | Evidence in response headers |
|---|---|---|
| Cloudflare Worker | `cloudflare/wrangler.jsonc` | `cf-ray`, and the Worker's own `x-protocol-atlas: proxy` |
| Host rewrite on the other project | Vercel dashboard (not in git) | neither — the app's own headers appear at the public path |

#### Measured topology of `shriful.tech` (verified 2026-10-03)

An earlier revision of this document blamed a **Netlify** proxy rule for the
`/protocol` behaviour. That attribution was wrong. Re-measuring every host and
path shows **no `x-nf-request-id` anywhere**, and every response carries
`x-vercel-id`. The live system is:

```
browser
  |
  v
Cloudflare DNS/proxy          (Server: cloudflare + CF-RAY on every response)
  |
  v
Vercel — "redirect apex to www" is ON
  |
  +-- shriful.tech/*            -> 307 -> https://www.shriful.tech/*
  |
  v
www.shriful.tech -> the PORTFOLIO project        (no /protocol route at all)
```

Raw evidence:

| Host + path | Status | Location | Fingerprint |
|---|---|---|---|
| `shriful.tech/` | **307** | `https://www.shriful.tech/` | `x-vercel-id`, `Content-Type: text/plain` |
| `shriful.tech/protocol` | **307** | `https://www.shriful.tech/protocol` | `x-vercel-id` |
| `shriful.tech/protocol/tcp` | **307** | `https://www.shriful.tech/protocol/tcp` | `x-vercel-id` |
| `www.shriful.tech/` | **200** | — | portfolio `<title>Shriful Islam …` |
| `www.shriful.tech/protocol` | **404** | — | portfolio's own 404 page |
| `www.shriful.tech/protocol/tcp` | **404** | — | portfolio's own 404 page |

Three conclusions follow directly from this table, and they overturn the earlier
diagnosis:

1. **The 307 is issued by Vercel, not by Cloudflare.** `Content-Type: text/plain`
   plus `x-vercel-id` is Vercel's redirect signature; a Cloudflare redirect rule
   would not carry `x-vercel-id`. So it is the portfolio project's
   *redirect apex to www* setting.
2. **The portfolio project has no `/protocol` route.** `/protocol`, `/tcp`,
   `/projects` all 404 on `www`; only `/robots.txt` and `/sitemap.xml` exist at
   the root. So nothing on the portfolio is currently publishing the app.
3. **The app was never reachable at `www.shriful.tech/protocol`.** What *did*
   work earlier — `/protocol/tcp` returning 200 — was measured on the **apex**
   before the apex→`www` redirect was turned on. Once that redirect appeared,
   every apex path (including `/protocol/tcp`) began 307-ing to `www`, where
   nothing is mounted. That is why `test:public` fell from 6/8 to 1/8: the one
   passing assertion is `resolves without looping`, because a 307 is now a
   finite redirect instead of a self-loop.

So the correct fix is the **Cloudflare Worker on the apex**, because the apex is
the only host in this topology where a request can be served by something we
control **before** Vercel's apex→`www` redirect gets a chance to answer.

### 2.2 Fix — deploy the Worker on the apex route

```bash
cd cloudflare
npx wrangler deploy
```

`wrangler.jsonc` already declares the route it needs:

```jsonc
"routes": [{ "pattern": "shriful.tech/protocol*", "zone_name": "shriful.tech" }]
```

Note the pattern is on the **apex** host, and deliberately **not** on `www`. If
it also matched `www.shriful.tech/protocol*`, the request would still be
answered by the portfolio project there (no `/protocol` route) and the Worker
would never run. The apex binding is what puts the Worker in front of the
visitor.

The Worker is already configured to match the origin:

```jsonc
"PROTOCOL_ORIGIN": "https://website-protocol-ten.vercel.app",
"PROTOCOL_ORIGIN_KEEPS_PREFIX": "false"    // origin serves /tcp at its root
```

### 2.3 Then stop the apex from leaving for `www`

The Worker only helps if the browser stays on the apex. There are two ways, and
you should pick **one**:

**Option A — turn off "Redirect apex to www" (simplest, recommended).**

In the Vercel portfolio project: *Settings → Domains → `shriful.tech` → remove
the redirect to `www.shriful.tech`* (or set `www.shriful.tech` to redirect **to**
the apex instead). With this off:

```
shriful.tech/protocol      -> Cloudflare Worker -> Vercel app   (200)
shriful.tech/              -> portfolio                          (200)
```

Both the app and the portfolio live on the apex, split by path. This is the
cleanest arrangement because the Worker's route pattern already expresses it.

**Option B — keep apex→`www`, and add a `www` rule that sends `/protocol` back.**

Only choose this if you specifically want `www` to stay canonical for the
portfolio. It requires a redirect on the `www` side:

```
https://www.shriful.tech/protocol*  ->  https://shriful.tech/protocol*   (302)
```

That redirect must be created in **Vercel** (project → Settings → Redirects), not
in Cloudflare, because Cloudflare never terminates the request for `www` — Vercel
does. Order matters: it must be evaluated **before** the portfolio's own catch-all,
or the 404 page wins.

Option B adds a hop and a second place for the prefix to be got wrong. Option A
is a single config toggle and keeps the path split explicit.

### 2.4 Do NOT put a proxy on the Vercel portfolio project

It is tempting to add a rewrite in the portfolio project:

```json
{ "rewrites": [{ "source": "/protocol/:path*", "destination": "https://website-protocol-ten.vercel.app/protocol/:path*" }] }
```

Do not do this. Two independent reasons:

1. It would mean editing the portfolio application, which is out of scope.
2. It cannot work while apex→`www` is on: the request that reaches the portfolio
   is already on `www`, and a rewrite there would still be answered by the
   portfolio's own routing first.

If you ever do move the proxy to Vercel, remove the Cloudflare route in the same
change — **two proxies in series** is how you get the self-redirect loop that an
earlier diagram in this file described.

### 2.5 Verify Stage 2

```bash
npm run test:public          # loops? assets? prefix? Vercel leaked?
```

Or by hand:

```bash
# The route that was broken — expect 200, and 0 redirects.
curl -s -o /dev/null -w 'status=%{http_code} redirects=%{num_redirects}\n' \
  -L https://shriful.tech/protocol

# Everything else still up.
for p in /protocol /protocol/tcp /protocol/udp /protocol/http \
         /protocol/https /protocol/i2c /protocol/can; do
  printf '  %-22s %s\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://shriful.tech$p")"
done
```

All eight must be `200`, and `/protocol` must report `redirects=0`.

**Right now these will not pass.** `test:public` is at **1/8** and every page is
a 307 to a host with no route. That is the expected result until 2.2 and 2.3 are
both done — the fix is a deploy plus one dashboard toggle, and both have to land
before the public URL works.

### 2.6 Verify in a browser (curl is not enough)

1. **Direct reload** — paste `https://shriful.tech/protocol/tcp` and press
   `Ctrl+Shift+R`. A 404 means the proxy rule or `basePath` is wrong.
2. **Client-side navigation** — from `/protocol`, click through to TCP then UDP.
   The address bar must read `/protocol/udp`, never `/udp`.
3. **DevTools → Network** — reload and filter by JS. Every request must be
   `/protocol/_next/...`. Anything at the apex `/_next/...` is being served by
   the portfolio and will break the page subtly.
4. **The address bar must never show `vercel.app`.**

### Stage 2 checklist

| # | Check | Expect |
|---|---|---|
| 1 | `curl -L https://shriful.tech/protocol` | `200`, `redirects=0` |
| 2 | All seven pages | `200` |
| 3 | An asset under `/protocol/_next/...` | `200` |
| 4 | No `vercel.app` in the address bar | true |
| 5 | Portfolio at `https://shriful.tech/` | unchanged |
| 6 | Browser reload + navigation | works, prefix retained |

---

## If something breaks, check in this order

1. **Is it the origin?** `curl` the Vercel URL directly. If that fails, Stage 2
   is irrelevant — fix Stage 1.
2. **Is it a redirect off the host you configured?** `curl -D -` the failing URL
   and read `location:`. A 307 to `www` means apex→`www` is still on and is
   answering before your proxy (see 2.3). A self-location means two proxies are
   fighting.
3. **Is it the wrong origin?** Confirm by `<title>`, not by hostname shape.
   `-ten` and non-`-ten` are different projects.
4. **Does the origin keep the prefix?** `/protocol/tcp` → 200 and `/tcp` → 404
   means it does.
5. **Is the prefix doubled?** `grep -c '/protocol/protocol'` on the served HTML
   must be `0`.

