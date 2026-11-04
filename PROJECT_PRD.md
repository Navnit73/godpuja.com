# GodPuja — CMS + E-commerce Platform PRD

Source briefs: [prd.md](prd.md) (original CMS + e-commerce brief, Stages 0–11) and **[docs/PRD_v1.1.md](docs/PRD_v1.1.md) (owner PRD v1.1, product source of truth from 2026-11-03)**. This is the working PRD: it maps v1.1 onto our stack and stages — see [§16](#16-prd-v11-adoption-scope-stack-mapping-and-gaps). Where §1–15 below conflict with v1.1, v1.1 + §16 win.

## 1. Vision & Objectives

GodPuja is a lightweight, fully admin-managed website and store for Hindu puja services and spiritual products (puja kits, samagri, idols, bookable pujas). Admins control navigation, footer, pages, homepage, catalog, SEO, and orders without touching code.

Objectives:
1. Everything visible on the storefront is data-driven (no hardcoded CMS content).
2. Fast: public pages are server-rendered/cached; APIs use lean, indexed, paginated queries.
3. Simple: one Next.js app, one MongoDB database, few dependencies.
4. SEO-first: metadata, sitemap, structured data and redirects are built into every content model.
5. Consistent, calm, minimal UI built on one token set (see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)).

Non-goals (v1): visual drag-and-drop page builder, multi-vendor, multi-language, multi-currency, native apps.

> **Superseded by PRD v1.1 (§16):** the product is now a *global* platform with five pillars (Shop, Temples & Donations, Pooja Vidhi, Aarti & Mantras, Book a Pooja). Multi-currency and multi-language are no longer non-goals — they are Phase 3, but data must be global-ready now (ISO currency codes, international addresses, UTC + IANA timezones). Still non-goals: open seller marketplace, native apps, visual page builder.

## 2. Existing Codebase Audit (Stage 0)

| Item | State |
|---|---|
| Framework | Next.js 16.4.3 App Router, React 19.3, TypeScript, Turbopack |
| Styling | Tailwind CSS v4 (CSS-first config via `@theme` in `src/app/globals.css`, **no** `tailwind.config.js`) |
| Theme | Saffron / kumkum / gold / sandal / tulsi palette, semantic tokens, Material elevation shadows, **light only** |
| Fonts | Cormorant Garamond (headings), Inter (body) via `next/font` |
| Components | `src/components/Logo.tsx` (logo + mark) |
| Assets | Lotus favicon (`src/app/icon.svg`, `apple-icon.png`), `public/logo*.svg` |
| Pages | Placeholder homepage with **hardcoded** content (to be replaced in Stage 7) |
| Backend / DB / Auth | None yet |
| Git | Repo initialised by create-next-app; no commits |
| Reusable | Tokens, utilities (`btn-*`, `card`), logo, layout/fonts |
| To remove | Hardcoded homepage content; stock `public/*.svg` assets; gradient `divider-gold` (PRD discourages gradients) |

Next 16 notes: request interception file is `proxy.ts` (formerly `middleware.ts`); route props use generated `LayoutProps`/`PageProps` types.

## 3. Roles & Workflows

Roles: `superadmin`, `admin`, `editor` (content only), `manager` (orders/inventory), `customer`.

**Admin:** login → dashboard → manage content (pages, nav, footer, homepage) / catalog / orders / settings → changes revalidate public cache → visible on storefront immediately.

**Customer:** browse home/category/search → product detail → cart → checkout (guest or account) → pay → order confirmation → order history (account).

**Order lifecycle:**
`pending` → `paid` → `processing` → `shipped` → `delivered`; `pending|paid|processing` → `cancelled`; `paid|processing|shipped|delivered` → `refunded` (full/partial recorded). Transitions validated server-side in one function; each transition appended to `order.history`.

## 4. Functional Requirements

Mapped to the brief's sections.

- **FR-NAV** (brief 4A): multiple menus (e.g. `header`, `mobile`), nested items (≤3 levels), reorder, enable/disable, link type `page | category | product | external`, separate desktop/mobile visibility.
- **FR-FOOT** (4B): columns with headings + links, social links, contact info, copyright, legal links, newsletter block, visibility + order.
- **FR-PAGE** (4C): unlimited pages, slug, category/subcategory, description, ordered reusable **sections** (typed blocks: richtext, image+text, banner, FAQ, product-grid, CTA), status `draft | published | scheduled`, preview via signed token, SEO + canonical + OG.
- **FR-PROD** (5): product master (name, slug, SKU, descriptions, images/gallery, category, brand, regular/sale price, stock, status, featured, attributes, variants, shipping, SEO, schema data), nested categories with SEO + image, storefront listings (featured, latest, best-selling, by category, related), search, filter, sort.
- **FR-HOME** (6): ordered, toggleable section list stored in DB (hero, banners, featured categories, product rails, text/image, testimonials, offers, custom block).
- **FR-ORD** (7): list/search/filter, detail, status + payment updates, internal notes, cancel/refund, history, CSV export; atomic stock decrement; idempotent order creation and payment webhooks.
- **FR-SEO** (8): slugs, dynamic metadata, canonical, OG/Twitter, sitemap.xml, robots.txt, JSON-LD (Breadcrumb, Product, Organization), 301 redirect table auto-populated on slug change.
- **FR-ADMIN** (10): 14 modules — dashboard, pages, navigation, footer, homepage, categories, products, inventory, orders, customers, SEO, media, settings, roles.
- **FR-MEDIA**: upload, list, delete; stored on object storage (S3-compatible / Cloudinary — decision in Stage 6), served via `next/image`.

## 5. System Architecture

Summary (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- Single Next.js app. Route groups: `(store)`, `(admin)/admin`, `api`.
- Server Components fetch data via a `src/server/services/*` layer directly (no HTTP hop). Route Handlers under `/api` serve the admin UI (client forms) and external callbacks (payment webhooks).
- MongoDB via Mongoose with a cached global connection. Models in `src/server/models`.
- Public CMS data cached with `unstable_cache`/`use cache` + tag revalidation on admin writes.
- Auth: JWT in httpOnly cookie, verified in `proxy.ts` (coarse) and in each handler (authoritative).

## 6. Database, API, Routes

- Schema and indexes: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- Endpoints: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)

Frontend routes:

Storefront: `/`, `/[...slug]` (CMS page, resolved by slug), `/shop/[[...path]]` (was `/category/[...path]`), `/product/[slug]`, `/search`, `/cart`, `/checkout`, `/order/[id]/confirmation`, `/account`, `/account/orders`, `/login`, `/register`.

Admin (`/admin/*`): `/` dashboard, `/pages`, `/navigation`, `/footer`, `/homepage`, `/categories`, `/products`, `/inventory`, `/orders`, `/customers`, `/seo`, `/media`, `/settings`, `/users`.

## 7. Authentication & Authorization

- Passwords: bcrypt (cost 12). Login rate-limited and generic error messages.
- Session: signed JWT (`jose`), 7-day, httpOnly + Secure + SameSite=Lax cookie. Role embedded; re-checked against DB for sensitive writes.
- RBAC: permission map `role → permissions` (e.g. `pages:write`, `orders:refund`) in one file; `requirePermission()` helper used by every admin handler and admin page.
- CSRF: SameSite cookie + `Origin` header check on mutating requests.

## 8. SEO Architecture

`generateMetadata` on every dynamic route from the document's `seo` sub-document (fallback to title/description). Canonical = absolute URL from `settings.siteUrl` + slug. Sitemap built from published pages/products/categories. `redirects` collection consulted in `proxy.ts`-adjacent lookup (cached) for 301s. JSON-LD generated by small typed helpers. Pages are SSR/ISR; `noindex` on drafts, cart, checkout, account, search params.

## 9. Performance Strategy

Indexed queries, `.lean()`, projections, pagination (cursor or page with hard max 50), no N+1 (use `$in` batches / one aggregation for product listings), cached public CMS data with tag revalidation, `next/image`, minimal client JS (admin forms only), single connection pool (`maxPoolSize` 10). Targets: public cached pages TTFB < 200 ms; uncached API p95 < 150 ms for list/detail on seed data (1k products); measured by a script in Stage 11 and recorded in audits.

## 10. Security Requirements

Zod validation on every input; no raw `$where`/operator injection (sanitize query objects); rate limiting on auth, checkout, search; HTML from rich text sanitized on write and render; upload type/size allowlist; secrets only in env; security headers (CSP, HSTS, frame-ancestors) in `next.config`; audit log for admin writes on orders/users; payment webhook signature verification + idempotency keys; least-privilege roles.

## 11. Errors & Validation

Uniform API envelope: success `{ data, meta? }`, failure `{ error: { code, message, fields? } }` with correct HTTP status. Zod schemas shared between client forms (React Hook Form resolver) and server. No swallowed errors; unexpected errors logged server-side and returned as generic 500. Error/not-found/empty/loading states required for every route.

## 12. Testing Strategy

- Unit: Vitest for services, status-transition logic, price calculation, slug/redirect logic, permissions.
- Integration: Vitest + `mongodb-memory-server` for API handlers and stock/order consistency (concurrent checkout test).
- E2E: Playwright for key flows (admin login → create product → appears on storefront; checkout).
- Static: `tsc --noEmit`, ESLint, `next build` on every stage.
- Accessibility: axe checks in Playwright, manual contrast check against tokens.

## 13. Stage-wise Plan

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Stages 0–12 follow the brief's order. One adjustment: **Media library basics move into Stage 6** (needed for product images) and **Stage 3 pages use text/image sections only** (Markdown rich text + image/text; category assignment for pages is deferred to Stage 6 when categories exist) (richer blocks added in Stage 7) to avoid a dependency cycle between pages and homepage sections.

## 14. Completion & Audit Tracking

Tracked in [PROJECT_TRACKER.md](PROJECT_TRACKER.md). Each stage ends with `docs/audits/STAGE_XX_AUDIT.md`. A stage closes only when implementation and audit are both verified.

## 15. Open Decisions

| # | Decision | Needed by | Default |
|---|---|---|---|
| 1 | MongoDB hosting | Stage 1 | **Decided: Atlas** (`godpuja` database; tests use `godpuja_test`) |
| 2 | Payment gateway | Stage 9 | **Deferred by owner** — decide before Stage 9 |
| 3 | Media storage | Stage 6 | **Decided: Cloudinary** |
| 4 | Guest checkout allowed? | Stage 9 | Yes |
| 5 | Currency / tax / shipping rules | Stage 9 | INR, tax-inclusive, flat + free-over-threshold shipping |
| 6 | Email provider for order mails / newsletter | Stage 9 | Resend |
| 7 | Adopt PRD v1.1; keep current tech stack | 2026-11-03 | **Decided by owner: yes, keep stack** (see §16.1) |
| 8 | Payment gateway(s) — PRD v1.1 suggests Stripe + regional (UPI) | Stage 13 | **Open — still blocking all paid flows** |
| 9 | Base accounting currency + launch countries | Stage 12 | Proposed: INR base; India first, other countries activated when shipping/payment are ready (v1.1 §23) |
| 10 | Brand palette: v1.1 §17 suggests ivory/sand/muted gold/terracotta/charcoal; current tokens are saffron/kumkum/gold/sandal/tulsi | Before Stage 17 release | Proposed: keep current tokens, re-check against v1.1 direction with designer |
| 11 | Store URLs: v1.1 uses `/shop/...`, we used `/category/...` | Stage 14 | **Done (Stage 14a):** `/shop/...`, permanent redirects from `/category/...` |
| 12 | Temple / Pandit / donation payment model (merchant of record, settlement, refunds) | Stage 20 | **Open — owner + legal** (v1.1 §6.8, §7, §14.1) |
| 14 | Pooja Vidhi: must a guide be reviewed before publishing? | Stage 15 | **Decided (default, easy to relax): yes** — a named reviewer and review date are required to publish or schedule (v1.1 §8) |
| 13 | Aarti/Mantra audio sourcing and licences | Stage 16 | **Open — content/legal**; module ships lyrics-only until rights are recorded |

## 16. PRD v1.1 adoption: scope, stack mapping and gaps

Owner decision (2026-11-03): adopt [PRD v1.1](docs/PRD_v1.1.md) as the product spec and **stay on the current tech stack**. v1.1 §14 lists recommended technologies; the table below records how each is satisfied in our stack instead.

### 16.1 Stack mapping (v1.1 §14 → ours)

| v1.1 layer | v1.1 recommendation | Our stack (retained) | How the v1.1 requirement is met |
|---|---|---|---|
| Frontend | Next.js, React, TS | Next.js 16 App Router, React 19, TS | Same. |
| UI | Tailwind + shadcn/ui | Tailwind v4 + own UI kit (`src/components/ui`) | Accessible components already axe-tested; no shadcn needed. |
| Commerce | Shopify or Medusa | In-app commerce (products, inventory, cart, orders in MongoDB) | This *is* the "one authoritative commerce engine"; no second commerce DB. |
| Database | PostgreSQL | MongoDB Atlas + Mongoose | Relations via ObjectId refs validated in services; unique indexes for slugs/idempotency keys; multi-document transactions (replica set) for orders, slot reservations and payments. |
| Auth | Auth.js / Supabase Auth | `jose` JWT cookie + bcrypt + `tokenVersion` revocation | Add email verification, password reset and OAuth (Google first) in-house using `jose` for OIDC token verification. |
| CMS | Sanity / Payload | In-app CMS (`Page` model, sections, publish/schedule/preview) | Extend with structured Pooja Vidhi and Aarti/Mantra models. |
| Storage | S3 / Cloudinary | Cloudinary | Same (audio uploads added for Aarti). |
| Search | Meilisearch / Algolia | MongoDB text indexes | Per-domain text indexes (products, temples, content); Atlas Search later if relevance is insufficient — stays inside MongoDB. |
| Payments | Stripe + regional | Provider adapter (`src/server/payments/provider.ts`), COD + signed webhook today | Gateway choice still open (decision 8). New `Payment` ledger shared by orders, bookings and donations. |
| Maps | Google Maps or equivalent | None yet | Lat/lng on temples + directions link / embed; no SDK needed initially. |
| Email | Resend / SES | Resend (decided, not yet wired) | Wire in Stage 13 with a `Notification` log. |
| Hosting | Managed | Pending owner decision | Unchanged. |

**Bounded domains (v1.1 §14):** each new domain gets its own models + `src/server/services/<domain>.ts` and talks to others only through service functions, sharing `User` identity: `temples`, `templeServices` / `slots`, `bookings`, `donations`, `pandits`, `devotional` (Aarti/Mantra). Product, booking and donation payments are separate `kind`s in one immutable `Payment` ledger with separate reporting (v1.1 §14.1).

**Double-booking prevention (v1.1 §15.1, §21.1 #7):** same pattern as inventory — a `slots` document per temple-service-slot with `capacity` and `reserved`; reservation is a conditional `findOneAndUpdate({ reserved: { $lt: capacity } }, { $inc: { reserved: n } })` inside the booking-creation transaction, plus an idempotency key unique index.

### 16.2 What already satisfies v1.1

| v1.1 area | Status |
|---|---|
| §4 Homepage — reorder / enable / disable modules via CMS | Done (Stage 7) — new section types needed for temples, aarti, pandit promo |
| §5.1–5.3 Catalogue, variants, per-product attributes, search/filter/sort, related | Done (Stages 6, 8) |
| §5.4 Cart, guest checkout, admin order processing, refunds (record-only), CSV export | Done (Stage 9), COD only |
| §8 Pooja Vidhi — draft/preview/schedule/publish, SEO fields | Partial — `Page.kind = "guide"`, markdown body only |
| §18 SEO — metadata, canonicals, sitemap, robots, JSON-LD, redirects | Done (Stage 10) |
| §19.1 Security — hashing, RBAC, validation, rate limits, CSP, audit log | Done (Stage 11) for current scope |
| §17.2 Accessibility basics | Done (Stage 11) |

### 16.3 Gaps (drive Stages 12–23)

1. **Global-ready money and addresses** — prices are integer paise with no currency code; `Address` hardcodes `country: "IN"` and `pincode` (`src/lib/storefront-api.ts`, `src/server/services/orders.ts`); `money.ts` formats INR only. v1.1 §13 needs ISO currency codes, international addresses, UTC + IANA timezones.
2. **Order statuses** — orders start at `confirmed` (correct for COD). v1.1 §5.4 needs `pending_payment`, `payment_failed`, `return_requested`, `refunded` so gateway orders never look paid before payment.
3. **Roles** — 5 flat roles; v1.1 §12 needs 8 incl. temple-scoped `temple_operator` (tenant authorization, §15.1).
4. **Customer accounts** — email verification, password reset, OAuth, order history, saved addresses, wishlist, profile preferences (v1.1 §11).
5. **Store completion** — coupons, tax, reviews/ratings, recently viewed, shipment tracking, return requests, invoices (v1.1 §5).
6. **Notifications** — no emails yet (orders, bookings, donations, account).
7. **Payment gateway** — blocked on owner (decision 8).
8. **Pooja Vidhi structured content** — samagri, steps, mantras, related aarti/products, author/reviewer (v1.1 §8).
9. **Aarti & Mantras** — not started; audio player + rights metadata with expiry (v1.1 §9).
10. **Temples, temple services, slots, bookings, operator portal** — not started (v1.1 §6).
11. **Donations** — not started (v1.1 §7).
12. **Pandits + home/online booking** — not started (v1.1 §10).
13. **Privacy workflows** — data access/deletion, retention for devotee data (v1.1 §19.2).
14. **Analytics** — GA4 / Search Console (v1.1 §16).

### 16.4 Revised stage plan

Detailed scope and exit criteria in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). The old Stage 12 (E2E & release) becomes **Stage 17 — Phase 1 release**, because v1.1 Phase 1 also includes customer accounts, Pooja Vidhi and Aarti/Mantra.

| Stage | v1.1 phase | Scope |
|---|---|---|
| 12 | Phase 1 | Global-ready foundations: currency codes, international addresses, order statuses, timezone utils, roles + scoped permissions |
| 13 | Phase 1 | Customer accounts + email notifications + payment gateway adapter (when decided) |
| 14 | Phase 1 | Store completion: coupons, tax, reviews, wishlist, tracking, returns, `/shop` URLs |
| 15 | Phase 1 | Pooja Vidhi structured content |
| 16 | Phase 1 | Aarti & Mantras + audio player + rights metadata |
| 17 | Phase 1 | Homepage pillar tiles, GA4, privacy pages, E2E, Phase 1 release |
| 18 | Phase 2 | Temple directory & profiles + verification |
| 19 | Phase 2 | Temple services, schedules, slots; temple operator portal |
| 20 | Phase 2 | Shared booking foundation + temple booking journey |
| 21 | Phase 2 | Donations |
| 22 | Phase 2 | Pandits + home/venue/online booking (request-and-confirm) |
| 23 | Phase 2 | Phase 2 E2E (v1.1 §21.1 scenarios 5–13) + release |
| — | Phase 3 | Hindi + more languages, multi-currency display, broader shipping/payments, automated availability, playlists, personalization |

P1 pillars (Temples, Book a Pooja) appear on the homepage and in navigation from Stage 17 with a "coming soon" state, satisfying v1.1 §4.1 / §21 before Phase 2 ships.
