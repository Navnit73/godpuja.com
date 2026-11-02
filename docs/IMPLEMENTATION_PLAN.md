# Implementation Plan

Workflow per stage (mandatory): read PRD + DESIGN_SYSTEM + TRACKER → implement only this stage → test → independent audit → fix → re-test → update tracker → write `docs/audits/STAGE_XX_AUDIT.md` → next stage.

| Stage | Scope | Key deliverables | Exit criteria |
|---|---|---|---|
| 0 | Audit & docs | PRD, design system, architecture, schema, API, plan, tracker | Docs reviewed by owner |
| 1 | Setup, DB, auth, design tokens | Install deps; `db.ts`; `User` model; session/password/permissions; login/logout/register/me; `proxy.ts` gate; finalise tokens (type scale, danger/success, input); remove gradient + stock assets; seed superadmin script; env validation; Vitest set up | `tsc`, lint, build pass; auth tests pass (valid/invalid login, role gate, rate limit); cookie flags verified |
| 2 | Admin shell | Sidebar/header/breadcrumbs, UI kit (Button, Input, Select, Table, Badge, Modal, Toast, EmptyState), permission-aware nav, users & roles module | Responsive shell; unauthorised roles blocked; axe clean |
| 3 | CMS pages | `pages` model/service/API, admin CRUD, section editor (richtext, image+text), publish/schedule/preview, dynamic `/[...slug]` rendering, sanitisation | Draft invisible publicly; scheduled publish works; preview token works |
| 4 | Navigation | `menus` model, nested editor with dnd-kit, desktop/mobile config, dynamic navbar + mobile drawer, cache tags | Admin change appears on storefront without deploy |
| 5 | Footer | `footer` model, editor, dynamic footer, newsletter capture endpoint | Same as stage 4 |
| 6 | Catalog | Categories (nested), products (variants, attributes), inventory, media upload, redirect-on-slug-change | Indexes verified with `explain()`; stock updates atomic |
| 7 | Homepage | `homepage` model, section builder (all section types), batched product rails | No hardcoded content; reorder/toggle works |
| 8 | Storefront | Category listing, product detail, search, filter/sort, related products | Pagination, empty/loading states, perf targets met |
| 9 | Cart & orders | Cart, checkout, payment integration, order lifecycle, admin orders (notes, refund, CSV) | Concurrent-checkout test: no oversell, no duplicates; webhook idempotent |
| 10 | SEO | Metadata everywhere, sitemap, robots, JSON-LD, canonical, 301 table, Twitter/OG | Rich-results validation; no duplicate titles/canonicals |
| 11 | Perf/security/a11y | Benchmarks script, CSP/headers, rate limits review, bundle analysis, axe + manual a11y | Targets in PRD §9 met and recorded |
| 12 | E2E & release | Playwright flows, bug fixing, final audit, production checklist, seed/demo data | All audits `AUDIT_COMPLETE` |

## Dependency notes

- Stage 3 limited to text/image sections; richer blocks arrive in Stage 7 (avoids a pages ↔ homepage cycle).
- Media upload basics move into Stage 6 (products need images).
- MongoDB replica set is required from Stage 6/9 for transactions (Atlas, or local `--replSet`).
- Stage 9 is blocked on payment gateway choice.

## Definition of done (every stage)

Type-check, lint and build clean · tests written and passing · no console errors · loading/empty/error states · responsive checked · tokens only · audit report written · tracker updated.
