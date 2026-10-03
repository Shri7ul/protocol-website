# Deploy workflow — Vercel first, then `shriful.tech/protocol`

Two independent stages. Stage 1 must be green before Stage 2 means anything,
because Stage 2 is a proxy: if the origin is broken, the proxy faithfully
proxies a broken site.

```
STAGE 1  Next.js  ->  Vercel                    (the app, on its own)
STAGE 2  shriful.tech/protocol  ->  proxy  ->  Vercel   (the public address)
```

---

## Stage 1 — Deploy the app to Vercel

### 1.1 Build locally and confirm the prefix

```bash
cd /d/website/protocol-website
npm run build          # production: bakes in basePath "/protocol"
```

The build must emit `/protocol`-prefixed URLs. Verify before deploying:

```bash
grep -oE '(src|href)="/protocol/_next/[^"]*"' .next/server/app/index.html | head -3
grep -c 'href="/_next/' .next/server/app/index.html     # must be 0
```

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
curl -s https://website-protocol-ten.vercel.app/protocol | grep -o '<title>[^<]*'
# expect: <title>Protocol Atlas — How data actually moves
```

### 1.3 Verify on Vercel BEFORE touching Cloudflare

```bash
for p in "" /tcp /udp /http /https /i2c /can; do
  printf '  /protocol%-6s %s\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' \
       "https://website-protocol-ten.vercel.app/protocol$p")"
done
```

All seven must be **200**.

### 1.4 Expect `/` to 404 — this is correct

`https://website-protocol-ten.vercel.app/` returns 404 **by design**. The app
carries `basePath: "/protocol"`, so nothing is mounted at the apex.

> The Vercel dashboard's preview panel loads the **apex**, so it always renders
> "The page could not be found" even when the deployment is perfectly healthy.
> Do not treat that panel as evidence of a failed deploy. Use the `/protocol`
> URL, or `npm run test:live`.

Optional, if you want the apex to work too — add `vercel.json` at the repo root:

```json
{ "redirects": [{ "source": "/", "destination": "/protocol", "permanent": false }] }
```

This is not required for the `shriful.tech/protocol` route and is not part of
the current setup.

### Stage 1 checklist

| # | Check | Command | Expect |
|---|---|---|---|
| 1 | Build has the prefix | `grep -oE '/protocol/_next/' .next/server/app/index.html \| head -1` | a match |
| 2 | No bare asset leaks | `grep -c 'href="/_next/' .next/server/app/index.html` | `0` |
| 3 | Origin serves the app | `npm run test:live` | 13/13 |
| 4 | All pages up | curl loop in 1.3 | seven × `200` |

---

## Stage 2 — Publish at `shriful.tech/protocol`

Stage 2 has exactly one job: make `/protocol` reachable on the portfolio domain
**without** the address bar ever showing the Vercel host.

### 2.1 Know which proxy you are using

There are two mechanisms that can front `/protocol`. **Only one should be
active** — if both are configured they will fight.

| Mechanism | Where it is configured | Evidence in response headers |
|---|---|---|
| Cloudflare Worker | `cloudflare/wrangler.jsonc` | `cf-ray`, no `x-nf-*` |
| Netlify proxy rule | Netlify dashboard (not in git) | `x-nf-request-id` |

Current state of `shriful.tech` (checked 2026-10-03):

| Path | Status | Served by |
|---|---|---|
| `/protocol/tcp` | **200** | Netlify proxy → Vercel |
| `/protocol/udp` … `/can` | **200** | Netlify proxy → Vercel |
| `/protocol/_next/...` | **200** | Netlify proxy → Vercel |
| `/protocol` | **308 infinite loop** | Netlify |
| `/protocol/` | **308 infinite loop** | Netlify |

So the pages work, but **the app root loops forever**. Everything below fixes
that.

### 2.2 The `/protocol` infinite redirect loop

**Symptom**

```bash
curl -s -o /dev/null -w '%{num_redirects}\n' -L https://shriful.tech/protocol
# 50   (curl's limit)
```

One hop, without following:

```
HTTP/1.1 308 Permanent Redirect
Location: https://shriful.tech/protocol
x-nf-request-id: 01M414MWWF9454D16Q6YDC9BAY
```

It redirects to *itself*.

**Cause**

The Netlify rule almost certainly reads:

```
/protocol/*   https://website-protocol-ten.vercel.app/protocol/:splat   200
```

The `*` requires at least one path segment. So:

- `/protocol/tcp` **matches** → proxied → 200 ✅
- `/protocol` does **not** match → falls through to Netlify's own
  trailing-slash handling → which issues a canonical redirect back to
  `/protocol` → **loop** ❌

`/protocol/` also redirects *to* `/protocol`, which confirms the two forms
disagree about which is canonical — the classic shape of this bug.

**Fix — add a rule for the bare path, above the wildcard**

In the portfolio's `public/_redirects` (or the Netlify dashboard's redirects),
put the exact path **before** the wildcard. Netlify resolves top-to-bottom on a
**first-match-wins** basis, so a general rule listed first will swallow a
specific one:

```
# 1. exact root — MUST come first
/protocol    https://website-protocol-ten.vercel.app/protocol   200!

# 2. everything under it
/protocol/*  https://website-protocol-ten.vercel.app/protocol/:splat   200!
```

Two things to keep:

- **Status `200`** makes it a **proxy** (address bar unchanged). A `301`/`308`
  would change the address bar and send the visitor to the Vercel host — the
  exact outcome the requirement forbids.
- **The `!` (force) flag** — required here. By default an existing file or route
  **shadows** the rule, and the portfolio is itself a Next.js app, so its own
  routing can claim the path first. Without `!` the proxy may simply not fire.
  In `netlify.toml` this is `force = true`.

**Why this shape matters**

```
/protocol          -> origin /protocol          (rule 1, exact)
/protocol/tcp      -> origin /protocol/tcp      (rule 2, :splat = "tcp")
/protocol/_next/x  -> origin /protocol/_next/x  (rule 2, :splat = "_next/x")
```

Both rules forward to the **same** origin path shape, so the origin (which
serves the app under `/protocol`) is asked correctly in every case. This is the
keeps-prefix shape — see `cloudflare/README.md` for why that distinction is
load-bearing.

One caveat from the Netlify docs: a rule whose `from` and `to` "resolve to the
same location" is treated as an infinitely looping rule and **ignored**. Since
rule 1's `to` is a different *host* from `from`, it is a legitimate proxy and not
a loop — but if you ever see the rule silently doing nothing, that is the clause
to look up.

**The same thing in `netlify.toml`** (preferred — it lives in version control,
unlike dashboard rules):

```toml
[[redirects]]
  from   = "/protocol"
  to     = "https://website-protocol-ten.vercel.app/protocol"
  status = 200
  force  = true

[[redirects]]
  from   = "/protocol/*"
  to     = "https://website-protocol-ten.vercel.app/protocol/:splat"
  status = 200
  force  = true
```

Place these **before** any catch-all such as `/*  /index.html  200`, or the
catch-all will win and the proxy will never fire.

### 2.3 Alternative: use the Cloudflare Worker instead

If you would rather have the Worker handle it (or want to drop the Netlify
rule), deploy it and remove the Netlify rules so only one proxy is live:

```bash
cd cloudflare
npx wrangler deploy
```

Then attach a route for `shriful.tech/protocol*` to the Worker, and **delete**
the Netlify `/protocol` rules — two proxies in series is a reliable way to
produce exactly the kind of loop in 2.2.

The Worker is already configured to match this origin:

```jsonc
"PROTOCOL_ORIGIN": "https://website-protocol-ten.vercel.app",
"PROTOCOL_ORIGIN_KEEPS_PREFIX": "true"    // origin serves /protocol/tcp
```

### 2.4 Verify Stage 2

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

### 2.5 Verify in a browser (curl is not enough)

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
2. **Is it a loop?** `-w '%{num_redirects}'` on the failing URL. A self-location
   means two proxies are fighting, or an exact-path rule is missing.
3. **Is it the wrong origin?** Confirm by `<title>`, not by hostname shape.
   `-ten` and non-`-ten` are different projects.
4. **Does the origin keep the prefix?** `/protocol/tcp` → 200 and `/tcp` → 404
   means it does.
5. **Is the prefix doubled?** `grep -c '/protocol/protocol'` on the served HTML
   must be `0`.
