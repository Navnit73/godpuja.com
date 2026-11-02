# Project Tracker

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `IMPLEMENTATION_COMPLETE` · `AUDIT_IN_PROGRESS` · `AUDIT_COMPLETE` · `BLOCKED`
A task is complete only after implementation works **and** audit verification passes.

**Current stage: 8 (not started)** · Last updated: 2026-11-02

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
| 8 | Storefront + product pages | Pending | Pending | NOT_STARTED |
| 9 | Cart, checkout, orders | Pending | Pending | BLOCKED (payment gateway deferred by owner) |
| 10 | SEO | Pending | Pending | NOT_STARTED |
| 11 | Performance, security, accessibility | Pending | Pending | NOT_STARTED |
| 12 | E2E, final audit, release | Pending | Pending | NOT_STARTED |

Audit reports: [Full audit stages 1–3](docs/audits/FULL_AUDIT_STAGES_1-3.md) · [Stage 1](docs/audits/STAGE_01_AUDIT.md) · [Stage 2](docs/audits/STAGE_02_AUDIT.md) · [Stage 3](docs/audits/STAGE_03_AUDIT.md) · [Stage 4](docs/audits/STAGE_04_AUDIT.md) · [Stage 5](docs/audits/STAGE_05_AUDIT.md) · [Stage 6](docs/audits/STAGE_06_AUDIT.md) · [Stage 7](docs/audits/STAGE_07_AUDIT.md).

Carried forward: Cloudinary live upload/delete test once credentials exist; homepage product cards and category tiles link to `/product/<slug>` and `/category/<path>`, which return 404 until the storefront pages ship in Stage 8; newsletter double opt-in + subscriber admin (Stage 9); trusted-proxy IP handling and body-size check (Stage 11); soft-404 status + slug-change 301s + malformed-URL 400 (Stage 10 proxy); single-instance vs shared cache decision (Stage 11); browser + axe accessibility pass of the admin UI (Stage 11/12; Playwright to be added). Stage 11: shared rate-limit store, search index review. Stage 12: automated API and form tests. Owner: rotate Atlas password, change seeded admin password, restart dev server.
