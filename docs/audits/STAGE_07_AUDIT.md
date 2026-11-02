# Stage 7 — Homepage: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).

## Delivered
- `Homepage` singleton model, service, admin API (`GET/PUT /api/admin/homepage`), public `GET /api/homepage`.
- 11 section types: hero, promotional banners, featured categories, featured products, latest products, best sellers, rich text, image + text, testimonials, offer (auto-expiry), custom block. Strict zod schema per type (alt text required with images, link/label pairs, safe URLs only, size/count limits, ≤30 sections, ≤6 product rails).
- Admin builder `/admin/homepage`: add/remove, move up/down, show/hide, per-type editors, image library picker, live announcements for screen readers, unsaved-change guard, 409 "reload latest".
- Storefront: `/` renders the sections (server components, no client JS). Falls back to the CMS page `home`, then a neutral placeholder. Nothing is hardcoded.
- Cache: 60 s, tagged `home` + `products` + `categories`, so product/category edits refresh rails immediately.

## Decisions
- Rails are rule-based (featured flag / newest / best sellers, optional category), not hand-picked products — avoids a product picker and stale ids; they run as one indexed `limit` query per rail (parallel, ≤6) and never one query per product. A single `$facet` query was rejected because it cannot use indexes for per-facet sorts.
- Reordering uses up/down buttons (keyboard/touch friendly); drag and drop is not needed for ≤30 items.
- Added index `{status, createdAt}` and extended `{status, isFeatured}` with `createdAt`; rails deliberately sort without an `_id` tiebreaker so sorts come straight from the index (verified: no in-memory SORT, no COLLSCAN).
- Changes go live on save (no draft/preview for the homepage), consistent with navigation and footer.

## Verification
- `tsc`, `eslint`, `next build` clean; Vitest **196 tests** pass (new `tests/homepage.test.ts`, 16): validation of every type incl. dangerous URL schemes, unknown type, duplicate ids, limits, mass assignment; first-save/stale/concurrent saves; reorder + enable/disable reflected publicly; markdown sanitisation; offer expiry; rails (featured/latest/best, category scoping, drafts excluded, no stock leak, empty rails hidden); featured categories (order kept, inactive/deleted/under-inactive-parent hidden, empty section dropped); explain() for all three rail queries.
- Live run on the test DB: placeholder before first save; PUT → homepage shows hero, categories, product rail, offer, hidden section absent, exactly one `<h1>`; reorder + hide changes the public order immediately; stale PUT 409; unauthenticated 401; unknown section type 400; admin page 200.

## Not verified / carried forward
- Product cards and category tiles link to `/product/<slug>` and `/category/<path>`; those pages arrive in Stage 8, so the links 404 until then.
- Browser pass + axe of the builder and homepage (Stage 11/12); homepage images use plain `<img>` (move to `next/image` with Cloudinary in Stage 8/11).
- Homepage SEO uses the site-wide defaults (title/description from the root layout); per-homepage SEO fields belong to Stage 10.
