# Stage 6 — Catalog: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).

## Delivered
- **Categories**: nested (≤3 levels), unique `path`, subtree re-pathing + 301 redirects in one transaction, cycle/depth/conflict checks, optimistic concurrency, delete guards, public tree (inactive hides subtree). Admin list/editor.
- **Products**: variants (per-variant SKU/price/stock), attributes, images, shipping, SEO, Markdown description (sanitised at read), integer-paise prices, activation rules, optimistic concurrency, slug-change 301. Admin list (search/status/category/low-stock) + editor.
- **Inventory**: atomic `$inc` with a `stock >= -delta` guard (no read-modify-write), absolute set, per-variant; admin page. Product edits never write stock.
- **Media**: Cloudinary signed upload over REST (no SDK), type decided by magic bytes (SVG/HTML rejected), 5 MB cap, alt text, delete refused while in use. Product/category editors pick from the library or paste a URL.
- **Public reads**: `GET /categories`, `/products` (filters, sort, text search, paging ≤50, rate limited), `/products/:slug` (cached); no stock counts exposed.
- `handle()` now rethrows Next.js control-flow signals, removing the build-time "unhandled error" noise noted in Stage 5.

## Decisions
- Stock is writable only through the inventory endpoint after creation, so an editor save can never overwrite stock changed by a sale (and inventory ops use `timestamps:false` so they never cause edit conflicts).
- `effectivePrice` (sale ?? price) is denormalised so price filter/sort is index-backed.
- Related products are deferred to Stage 8 (storefront).
- Description is Markdown (same sanitiser as pages), not stored HTML.

## Verification
- `tsc`, `eslint`, `next build` clean (no build warnings); Vitest **180 tests** pass (new: `tests/catalog.test.ts` 18, `tests/media.test.ts` 6) including: nested paths, subtree move + redirect chain-freedom, cycle/depth rejection, rollback on conflict, **25 concurrent decrements of 10 stock sell exactly 10**, per-variant guards, stock change not staling editors, variant-SKU uniqueness, public filters/sort/search/paging, inactive-ancestor hiding, **`explain()` shows index use (no COLLSCAN) for category listing, featured, price sort/range, popular, slug, text search, category path**, magic-byte sniffing against SVG/HTML/script payloads, Cloudinary signature vs the documented vector, money conversions.
- Live run (test DB, `next start`): create category/product → public list/detail/categories correct; stock −2 then −9 → 409; product edit after a stock change succeeds (no false 409); renamed slug → old URL 404, new 200; upload without credentials → 503 `NOT_CONFIGURED`; disguised SVG → 400; all new admin pages 200; unauthenticated 401; cross-origin POST 403; category with products cannot be deleted.

## Not verified / carried forward
- **Cloudinary upload/destroy has never run against the real service** (no credentials in `.env.local`). Signing is unit-tested against Cloudinary's documented vector only. Needs one manual upload + delete once credentials are set.
- Browser pass + axe of the new admin pages (Stage 11/12).
- Redirects are written but only *consumed* in Stage 10 (proxy lookup); until then an old category/product URL returns 404 instead of 301.
- Product search index (`$text`) uses default English stemming; Hindi/transliterated names need a review in Stage 8/11. No hard cap on variants×stock beyond 50 variants.
- Request-size limit for the multipart upload relies on `Content-Length` (Stage 11 hardening, same as JSON bodies).
