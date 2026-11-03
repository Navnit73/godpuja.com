# Architecture

## Overview

One Next.js 16 (App Router) application + MongoDB. No separate backend service.

```
Browser ──► Next.js
            ├─ proxy.ts                (coarse auth gate for /admin, redirect lookup)
            ├─ (store) routes          Server Components → services → MongoDB   (cached, tag-revalidated)
            ├─ (admin)/admin routes    Server Components + client forms          (no cache, permission-checked)
            └─ /api/*                  Route Handlers (admin mutations, checkout, webhooks)
                         │
                         ▼
               src/server/services  ──►  Mongoose models ──► MongoDB
```

## Folder structure

```
src/
  app/
    (store)/            storefront routes + layout (dynamic navbar/footer)
    (admin)/admin/      admin routes + shell layout
    api/                route handlers
    sitemap.ts robots.ts icon.svg globals.css layout.tsx
  components/
    ui/                 Button, Input, Table, Badge, Modal… (token-based)
    store/ admin/       feature components
    Logo.tsx
  server/
    db.ts               cached Mongoose connection
    models/             one file per collection
    services/           business logic (pages, products, orders, nav…) — the only layer touching models
    auth/               session (jose), password (bcrypt), permissions, requirePermission()
    cache.ts            cache tags + revalidate helpers
  lib/
    validation/         Zod schemas (shared client + server)
    api.ts              centralized client fetch wrapper
    seo.ts              metadata + JSON-LD helpers
    slug.ts utils.ts
  proxy.ts
docs/  PROJECT_PRD.md  DESIGN_SYSTEM.md  PROJECT_TRACKER.md
```

## Key decisions

| # | Decision | Reason |
|---|---|---|
| A1 | Server Components call services directly; `/api` only for client mutations and external callbacks | Avoids an internal HTTP hop; fastest reads |
| A2 | Native `fetch` wrapper in `lib/api.ts` (no Axios) | Fewer dependencies |
| A3 | Services are the only code that imports models | One place for validation, caching, invalidation |
| A4 | Sections are typed JSON blocks (`type` + `data`) validated by a Zod discriminated union | Flexible without a visual builder |
| A5 | `cacheComponents` is enabled in `next.config.ts`: public CMS reads use `"use cache"` + `cacheLife` + `cacheTag`; anything reading cookies/headers must sit inside `<Suspense>`. Cache tags per content type (`nav`, `footer`, `home`, `page:<slug>`, `product:<slug>`, `categories`); admin writes call `revalidateTag` | Instant CMS updates, cached reads |
| A6 | JWT cookie sessions via `jose` (HS256, 7 days). The token carries role + `tokenVersion`, but every admin page and API handler re-reads the user from the DB (role, active, tokenVersion); `proxy.ts` is only a coarse gate | Stateless and edge-compatible `proxy.ts` |
| A7 | MongoDB transactions (replica set required; Atlas provides it) for order creation + stock | Consistency; local dev needs a replica set (`mongod --replSet`) |
| A8 | Stock decrement via atomic `findOneAndUpdate({ stock: { $gte: qty } })` inside the transaction | Prevents overselling |
| A9 | Idempotency key on order creation and payment events (unique index) | No duplicate orders/payments |
| A10 | shadcn/ui used only as copy-in primitives (Dialog, DropdownMenu, Popover) restyled with tokens | Accessibility without a heavy library |
| A12 | CMS rich text is stored as **Markdown** (`marked`) and converted to HTML + sanitized (`sanitize-html` allowlist) at read time, inside the cached public reader | No heavy WYSIWYG dependency; sanitization at render is the security boundary and cannot be bypassed by stored data |
| A13 | Preview uses a separate uncached route `/preview/[token]` (192-bit token, rotatable) instead of a `?preview=` query param | Keeps public routes cacheable; no runtime APIs in cached scopes |
| A14 | Scheduled publishing is evaluated at read time (`status=scheduled AND publishAt<=now`); public cache revalidates every 60 s; no cron | Simple and consistent; up-to-60 s delay accepted |
| A15 | Admin page edits use optimistic concurrency: PATCH must send the `updatedAt` it loaded (`baseUpdatedAt`); a mismatch returns 409 instead of overwriting | Two editors cannot silently clobber each other |
| A16 | **Deployment (decided at Stage 11, default pending owner sign-off): run ONE long-lived Node instance** (`next build && next start`, e.g. a VPS/Railway/Render/Fly machine in the same region as the Atlas cluster). `"use cache"` and the per-instance caches (proxy route checks, category snapshot, per-instance rate limits) then stay coherent and `revalidateTag` is immediate. Scaling out later requires a shared cache handler (`cacheHandlers` in next.config, e.g. Redis) — security-critical rate limits are already shared (A19). Serverless is not recommended: per-instance caches would be cold and duplicated | Simplest correct setup for the expected load; avoids stale CMS pages across instances |
| A17 | Static CSP in `next.config.ts` (no per-request nonces): `cacheComponents` prerenders shells, which cannot carry a nonce. Scripts allow `'self' 'unsafe-inline'`; XSS defence for stored content is the sanitiser (A12). `upgrade-insecure-requests` + HSTS only when `SITE_URL` is https at build time | Keeps PPR/caching; still blocks foreign scripts, plugins, framing, foreign fetch, `<base>` and cross-site form posts |
| A18 | In-process category snapshot (`services/category-snapshot.ts`, 10 s TTL, cleared by every category write) serves listing/detail/rail category lookups; cart and checkout read fresh | Cuts public API reads to one DB round trip (PRD §9 p95 target) |
| A19 | Two rate-limit stores: MongoDB fixed-window counters (`rateLimits`, TTL) for login/register/checkout/newsletter; in-memory for high-volume public reads. Client IP from the trusted-proxy entry of X-Forwarded-For (`TRUSTED_PROXY_HOPS`) or a configured edge header | Security limits hold across instances; hot reads avoid an extra round trip |
| A20 | Storefront images stay plain `<img>` (admins paste URLs from any host, so the Next optimizer would have to proxy arbitrary origins); Cloudinary URLs get `f_auto,q_auto,c_limit,w_N` transforms + `srcset` (`lib/image.ts`) | Modern formats and right-sized images without an open image proxy |
| A21 | PRD v1.1 adopted on the existing stack (owner, 2026-11-03): MongoDB stays the single store for commerce and all new domains (temples, bookings, donations, pandits, devotional); new domains are separate models + services sharing `User`; one immutable `Payment` ledger with `kind`; slot reservations use conditional `$inc` in a transaction (same as inventory). Mapping in PROJECT_PRD §16.1 | Avoids a second database / commerce engine; reuses proven transaction and concurrency patterns |
| A22 | Stage 12 global foundations: money = integer minor units + ISO 4217 (`lib/money.ts`, catalogue in `BASE_CURRENCY`, currency stored per order); addresses = ISO country + per-country rules (`lib/address.ts`), shipping limited by `SHIPPING_COUNTRIES`; time = UTC storage + IANA zones via `Intl` only (`lib/time.ts`, no date library); roles per PRD §12 with legacy-name normalisation and temple scope (`server/auth/scope.ts`, 404 on out-of-scope) | Global-ready data without new dependencies; old rows/sessions keep working until the migration runs |
| A11 | Drag-and-drop with `@dnd-kit` (admin nav/home/sections only) | Small, accessible; only genuinely needed lib for reordering |

## Dependencies (planned)

`mongoose`, `zod`, `react-hook-form`, `@hookform/resolvers`, `jose`, `bcryptjs`, `@dnd-kit/*`, `sanitize-html`; dev: `vitest`, `mongodb-memory-server`, `@playwright/test`. Added only in the stage that needs them.

## Caching & rendering

- Storefront pages: Server Components with cached service reads + tag revalidation (ISR-like).
- Admin: always dynamic.
- Cart: client state (localStorage) validated server-side at checkout; prices always recomputed on server.

## Error handling

`ApiError(code, status, message, fields?)` thrown in services, mapped to the standard envelope in a single `handle()` wrapper used by all route handlers.

## Environment variables

`MONGODB_URI`, `AUTH_SECRET` (≥32 chars), `SITE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` (media, decided), later `PAYMENT_*` (undecided), `EMAIL_*`. Template in `.env.example`; real values only in `.env.local` (git-ignored). Tests force the DB name to `godpuja_test`.
