# Project Tracker

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `IMPLEMENTATION_COMPLETE` · `AUDIT_IN_PROGRESS` · `AUDIT_COMPLETE` · `BLOCKED`
A task is complete only after implementation works **and** audit verification passes.

**Current stage: 14c (Stage 14 complete; independent audit pending — stages 8–13 and 14a–c await audit)** · Last updated: 2026-11-03 · Payment gateway deferred by owner (COD only)

**2026-11-03:** Owner adopted [PRD v1.1](docs/PRD_v1.1.md) on the current tech stack. Stages 12–23 added (see [PROJECT_PRD.md §16](PROJECT_PRD.md) and [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md)); old Stage 12 (E2E/release) is now Stage 17.

| Stage | Task | Implementation | Audit | Status |
|---|---|---|---|---|
| 0 | Existing codebase audit | Complete | Pending owner review | IMPLEMENTATION_COMPLETE |
| 0 | PROJECT_PRD.md | Complete | Pending owner review | IMPLEMENTATION_COMPLETE |
| 0 | DESIGN_SYSTEM.md | Complete | Pending owner review | IMPLEMENTATION_COMPLETE |
| 0 | docs/ARCHITECTURE.md | Complete | Pending owner review | IMPLEMENTATION_COMPLETE |
| 0 | docs/DATABASE_SCHEMA.md | Complete | Pending owner review | IMPLEMENTATION_COMPLETE |
| 0 | docs/API_DOCUMENTATION.md | Complete | Pending owner review | IMPLEMENTATION_COMPLETE |
| 0 | docs/IMPLEMENTATION_PLAN.md | Complete | Pending owner review | IMPLEMENTATION_COMPLETE |
| 1 | Install deps + env validation | Complete | Complete | AUDIT_COMPLETE |
| 1 | Database connection (Atlas, pooled) | Complete | Complete | AUDIT_COMPLETE |
| 1 | User model + seed superadmin | Complete | Complete | AUDIT_COMPLETE |
| 1 | Auth (login/logout/register/me, session, RBAC helpers) | Complete | Complete | AUDIT_COMPLETE |
| 1 | proxy.ts admin gate | Complete | Complete | AUDIT_COMPLETE |
| 1 | Finalise design tokens (type scale, semantic colors, input) | Complete | Complete | AUDIT_COMPLETE |
| 1 | Cleanup (gradient divider, stock assets, hardcoded home) | Complete | Complete | AUDIT_COMPLETE |
| 1 | Test setup (Vitest) + auth/security tests (33) | Complete | Complete | AUDIT_COMPLETE |
| 2 | Session revocation (tokenVersion) | Complete | Complete | AUDIT_COMPLETE |
| 2 | Users & roles API + service (transactional rules) | Complete | Complete | AUDIT_COMPLETE |
| 2 | UI kit (Button, Field, Modal, Toast, EmptyState, tokens) | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 2 | Admin shell (sidebar, header, breadcrumbs, permission-aware nav) | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 2 | Users & roles admin page + dashboard | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 3 | Pages model, service, admin API (concurrency-safe) | Complete | Complete | AUDIT_COMPLETE |
| 3 | Markdown sections + sanitization | Complete | Complete | AUDIT_COMPLETE |
| 3 | Publish / unpublish / schedule | Complete | Complete | AUDIT_COMPLETE |
| 3 | Preview (token route, headers) | Complete | Complete | AUDIT_COMPLETE |
| 3 | Dynamic public rendering + SEO metadata | Complete | Complete (soft-404 deferred to Stage 10) | AUDIT_COMPLETE |
| 3 | Admin pages list + editor UI | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 4 | Menus model, service, admin API (concurrency-safe) | Complete | Complete | AUDIT_COMPLETE |
| 4 | Admin navigation editor (nested, dnd-kit + keyboard buttons) | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 4 | Dynamic navbar + mobile menu, cache tags | Complete | Complete | AUDIT_COMPLETE |
| 5 | Footer model, service, admin API (concurrency-safe) | Complete | Complete | AUDIT_COMPLETE |
| 5 | Admin footer editor | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 5 | Dynamic footer + newsletter capture endpoint | Complete | Complete | AUDIT_COMPLETE |
| 6 | Categories (nested, 3 levels, path + 301 on move, transactional) | Complete | Complete | AUDIT_COMPLETE |
| 6 | Products (variants, attributes, SEO, optimistic concurrency) + admin UI | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 6 | Inventory (atomic, race-tested) + admin UI | Complete | Complete | AUDIT_COMPLETE |
| 6 | Media library (Cloudinary signed upload, magic-byte checks) | Complete — live upload **untested: no Cloudinary credentials yet** | Complete (live Cloudinary upload unverified) | IMPLEMENTATION_COMPLETE |
| 6 | Redirect table + public catalog reads + index verification (explain) | Complete | Complete | AUDIT_COMPLETE |
| 7 | Homepage model, service, admin API (concurrency-safe) | Complete | Complete | AUDIT_COMPLETE |
| 7 | Section builder UI (11 section types, reorder, toggle) | Complete | Complete (browser/axe pending) | AUDIT_COMPLETE |
| 7 | Storefront homepage rendering + batched product rails + cache tags | Complete | Complete | AUDIT_COMPLETE |
| 8 | Category pages (breadcrumbs, subcategories, filter/sort/pagination), search page, product detail (gallery, variants, related) | Complete | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 8 | Cart (browser, server-validated), checkout (guest, COD), order confirmation (token) UI | Complete | Self-verified (browser/axe pending) | IMPLEMENTATION_COMPLETE |
| 9 | Cart validation, guest checkout (idempotent, transactional stock), order numbers | Complete | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 9 | Order lifecycle (transition table, cancel restores stock once), payment status, notes, refunds (record-only), CSV export | Complete | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 9 | Admin orders UI (list, filters, detail, actions, history) | Complete | Self-verified (browser/axe pending) | IMPLEMENTATION_COMPLETE |
| 9 | Payment gateway adapter | **BLOCKED — owner has not chosen a gateway.** COD provider + generic signed webhook only (adapter slot documented) | — | BLOCKED |
| 10 | Proxy: real 404s, 301 redirect table, malformed-URL 400 | Complete | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 10 | Metadata everywhere (titles, canonicals, OG/Twitter, noindex rules), JSON-LD (Product, Breadcrumbs, Organization, WebSite) | Complete | Self-verified; rich-results validator not run (needs a public URL) | IMPLEMENTATION_COMPLETE |
| 10 | sitemap.xml, robots.txt, admin SEO settings + redirects manager, CMS page slug 301s | Complete | Self-verified (browser/axe pending) | IMPLEMENTATION_COMPLETE |
| 11 | Security: CSP + COOP (HTTPS-only directives gated on SITE_URL), shared MongoDB rate limits (login/register/checkout/newsletter), trusted-proxy client IP, search rate limit, user audit log, npm audit (0) | Complete | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 11 | Performance: bench seed (1k products) + benchmark script, category snapshot (1 DB round trip per API read), index review, Cloudinary responsive images, bundle report | Complete — **API p95 < 150 ms not reliably met from this machine (remote Atlas, 97 ms ping); re-measure from same-region host at Stage 17 (Phase 1 release)** | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 11 | Accessibility: axe/CSP sweep (52 scans, 0 findings), skip link, landmarks/headings, checkout error focus, input-border contrast token, token contrast tests | Complete | Self-verified (no screen-reader pass) | IMPLEMENTATION_COMPLETE |
| 11 | Fix: checkout rejected products without variants (`variantSku: null`) — Stage 8/9 bug | Complete + regression test | Self-verified | IMPLEMENTATION_COMPLETE |
| 12 | Global-ready foundations: currency codes, international addresses, order statuses, timezones, v1.1 roles + temple scope, migration script | Complete — migration applied to `godpuja` 2026-11-03 (1 order) | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 13 | Customer accounts (verify, reset, Google OIDC, /account dashboard, saved addresses, order history, guest-order claiming), Resend notifications, immutable payment ledger | Complete — gateway adapter deferred by owner; real Resend/Google untested (no credentials) | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 14a | `/shop` URLs (+301 from `/category`), shipment tracking, customer cancel/return, invoice | Complete — carrier deep links unverified live; migration `migrate:stage14` dry-run 0 rows | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 14b | Coupons (cart + checkout, atomic limits, released on cancel) and destination tax rules (inclusive/exclusive) with admin screens | Complete — shipping rates still not per country; tax rates are the owner's to configure | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 14c | Verified-purchase moderated reviews + ratings (cards, product page, structured data, "Top rated" sort), filters (deity, material, occasion, size, in stock, rating), wishlist, recently viewed, admin Reviews queue | Complete — per-product tax class, shipping per country and per-item returns remain open | Self-verified; independent audit pending | IMPLEMENTATION_COMPLETE |
| 15 | Pooja Vidhi structured content | Pending | Pending | NOT_STARTED |
| 16 | Aarti & Mantras + audio player + rights metadata | Pending | Pending | NOT_STARTED |
| 17 | Phase 1 release: pillar tiles, coming-soon entries, GA4, privacy pages, E2E, final audit (was Stage 12) | Pending | Pending | NOT_STARTED |
| 18 | Temples directory & profiles + verification | Pending | Pending | NOT_STARTED |
| 19 | Temple services, schedules, slots, operator portal | Pending | Pending | NOT_STARTED |
| 20 | Booking foundation + temple booking journey | Pending | Pending | NOT_STARTED |
| 21 | Donations (blocked on decision 12) | Pending | Pending | NOT_STARTED |
| 22 | Pandits + home/venue/online booking | Pending | Pending | NOT_STARTED |
| 23 | Phase 2 E2E + release | Pending | Pending | NOT_STARTED |

Audit reports: [Full audit stages 1–3](docs/audits/FULL_AUDIT_STAGES_1-3.md) · [Stage 1](docs/audits/STAGE_01_AUDIT.md) · [Stage 2](docs/audits/STAGE_02_AUDIT.md) · [Stage 3](docs/audits/STAGE_03_AUDIT.md) · [Stage 4](docs/audits/STAGE_04_AUDIT.md) · [Stage 5](docs/audits/STAGE_05_AUDIT.md) · [Stage 6](docs/audits/STAGE_06_AUDIT.md) · [Stage 7](docs/audits/STAGE_07_AUDIT.md) · [Stage 9](docs/audits/STAGE_09_AUDIT.md) · [Stage 10](docs/audits/STAGE_10_AUDIT.md) · [Stage 11](docs/audits/STAGE_11_AUDIT.md) · [Stage 12](docs/audits/STAGE_12_AUDIT.md) · [Stage 13](docs/audits/STAGE_13_AUDIT.md) · [Stage 14a](docs/audits/STAGE_14A_AUDIT.md) · [Stage 14b](docs/audits/STAGE_14B_AUDIT.md) · [Stage 14c](docs/audits/STAGE_14C_AUDIT.md).

Carried forward: Stage 9 — payment gateway adapter pending owner decision (COD + generic webhook only); customer accounts / order history deferred (guest token only); no order emails yet (provider Resend, Stage 9 follow-up); Cloudinary live upload/delete test once credentials exist; homepage product cards and category tiles link to `/product/<slug>` and `/category/<path>`, which return 404 until the storefront pages ship in Stage 8; newsletter double opt-in + subscriber admin (Stage 9); trusted-proxy IP, body-size check, shared rate-limit store, search index review, admin axe pass: done in Stage 11. Deployment: single instance (ARCHITECTURE A16) — owner to confirm hosting. Stage 17: re-run `npm run bench` from a host in the Atlas region; screen-reader pass; update outdated "CMS home at /" check in browser-audit. Stage 17: automated API and form tests. Owner: rotate Atlas password, change seeded admin password, restart dev server.
