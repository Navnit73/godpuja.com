# Stage 7 — Homepage: verification report

Status: **AUDIT_COMPLETE** (independent read-only review by a separate agent; no High findings; Medium/Low findings fixed or carried forward below).

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

## Independent audit findings (2026-11-02)
**Fixed (tests added in `tests/homepage.test.ts`):** (M) URL validation showed "Invalid input" → single schemas with clear messages (also applied to menus and pages) and a 2000-char cap; (M) validation errors were keyed by position and could stick to the wrong section / block collapsing → cleared on any change, offending sections are opened but can be collapsed; (M) several heroes meant several `<h1>` → at most one hero (schema + disabled Add); (M) replacing an image kept the old alt text → alt follows the new image; (M) rails could reorder between cache refreshes when products tie → `_id` tiebreaker with indexes ending in `_id` (still index-served, verified by explain); (L) stored sections are re-validated at read time and a malformed one is skipped; (L) section ids restricted to `[A-Za-z0-9_-]`; (L) empty image+text block rejected; expired-offer hint in the editor; (L) rail lists get an accessible name when the heading is empty; (L) clearer, unique accessible names for visible/move/remove controls (label-in-name), `aria-controls` only when open, textarea errors linked; (L) `isoToIstInput` tolerates garbage.
**Carried forward:** best sellers with zero sales still show (by newest), shown unsold products are not hidden; the fallback to the CMS `home` page / placeholder also applies when every section is hidden (intended; documented in API docs); focus is not restored after remove/move in the builder; number field coerces blank to 0; component/route-level tests; Stage 8 will make product/category links resolve.
