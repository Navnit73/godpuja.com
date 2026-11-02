# GodPuja — CMS + E-commerce Platform PRD

Source brief: [prd.md](prd.md). This is the working PRD. Status: **Stage 0 complete (documentation)**.

## 1. Vision & Objectives

GodPuja is a lightweight, fully admin-managed website and store for Hindu puja services and spiritual products (puja kits, samagri, idols, bookable pujas). Admins control navigation, footer, pages, homepage, catalog, SEO, and orders without touching code.

Objectives:
1. Everything visible on the storefront is data-driven (no hardcoded CMS content).
2. Fast: public pages are server-rendered/cached; APIs use lean, indexed, paginated queries.
3. Simple: one Next.js app, one MongoDB database, few dependencies.
4. SEO-first: metadata, sitemap, structured data and redirects are built into every content model.
5. Consistent, calm, minimal UI built on one token set (see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)).

Non-goals (v1): visual drag-and-drop page builder, multi-vendor, multi-language, multi-currency, native apps.

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

Storefront: `/`, `/[...slug]` (CMS page, resolved by slug), `/category/[...path]`, `/product/[slug]`, `/search`, `/cart`, `/checkout`, `/order/[id]/confirmation`, `/account`, `/account/orders`, `/login`, `/register`.

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

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Stages 0–12 follow the brief's order. One adjustment: **Media library basics move into Stage 6** (needed for product images) and **Stage 3 pages use text/image sections only** (richer blocks added in Stage 7) to avoid a dependency cycle between pages and homepage sections.

## 14. Completion & Audit Tracking

Tracked in [PROJECT_TRACKER.md](PROJECT_TRACKER.md). Each stage ends with `docs/audits/STAGE_XX_AUDIT.md`. A stage closes only when implementation and audit are both verified.

## 15. Open Decisions

| # | Decision | Needed by | Default |
|---|---|---|---|
| 1 | MongoDB hosting (Atlas vs local/self-hosted) and connection string | Stage 1 | Atlas free tier; local `mongod` for dev |
| 2 | Payment gateway (Razorpay is typical for India; Dodo/Stripe alternatives) | Stage 9 | Razorpay |
| 3 | Media storage (Cloudinary vs S3-compatible) | Stage 6 | Cloudinary |
| 4 | Guest checkout allowed? | Stage 9 | Yes |
| 5 | Currency / tax / shipping rules | Stage 9 | INR, tax-inclusive, flat + free-over-threshold shipping |
| 6 | Email provider for order mails / newsletter | Stage 9 | Resend |
