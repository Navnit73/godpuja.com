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
| A5 | Cache tags per content type (`nav`, `footer`, `home`, `page:<slug>`, `product:<slug>`, `categories`); admin writes call `revalidateTag` | Instant CMS updates, cached reads |
| A6 | JWT cookie sessions via `jose`; role in token, re-verified in DB for destructive actions | Stateless and edge-compatible `proxy.ts` |
| A7 | MongoDB transactions (replica set required; Atlas provides it) for order creation + stock | Consistency; local dev needs a replica set (`mongod --replSet`) |
| A8 | Stock decrement via atomic `findOneAndUpdate({ stock: { $gte: qty } })` inside the transaction | Prevents overselling |
| A9 | Idempotency key on order creation and payment events (unique index) | No duplicate orders/payments |
| A10 | shadcn/ui used only as copy-in primitives (Dialog, DropdownMenu, Popover) restyled with tokens | Accessibility without a heavy library |
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

`MONGODB_URI`, `AUTH_SECRET`, `SITE_URL`, later `PAYMENT_*`, `MEDIA_*`, `EMAIL_*`.
