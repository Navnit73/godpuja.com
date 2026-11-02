# Stage 6 — Catalog: verification report

Status: **AUDIT_COMPLETE** (independent read-only review by a separate agent; 2 High + 7 Medium findings fixed, remainder carried forward below). Live Cloudinary upload is still unverified (no credentials).

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

## Independent audit findings (2026-11-02)
**Fixed (each with a regression test in `tests/catalog.test.ts`):**
- (High) A product's sale price could never be cleared on update (Mongoose drops `undefined` in `$set`) → stored as `null`.
- (High) Hiding a category did not hide its products on the public list, search, featured, detail or homepage rails → public queries exclude products in any inactive category or under an inactive ancestor (`loadCategoryIndex`); detail returns 404.
- (Med) Variant option names with `.`/`$`/prototype names caused a 500 → rejected by validation; `handle()` now maps Mongoose validation/cast errors to 400.
- (Med) Deleting media only checked products and categories → also checks pages (section images, OG image), the homepage and every `ogImage`.
- (Med) Category write-skew: concurrent opposite moves could form a cycle; create/delete could orphan a child → structural writes run in transactions and bump a `treeVersion` on the parents involved (forces a write conflict + retry); tested with 4 rounds of simultaneous opposite moves and create-vs-delete.
- (Med) Stale redirects could shadow a newly created URL, and deleted pages left dangling redirects → cleared on create and on delete.
- (Med) Chunked bodies bypassed the size limit → `readLimited` streams and aborts at the limit (JSON 1 MB, uploads 5 MB + overhead).
- (Med) Variant sale price was not checked against the product price when the variant had none; product SKUs and variant SKUs were separate namespaces → one namespace enforced across products/variants; variant sale rule uses the effective price.
- (Med) Image picker only reached the 60 newest images → "Load more".
- (Low) Stock had no upper cap via repeated `+delta` → capped at 10 M atomically; inventory route no longer re-reads the product (cache invalidation could be skipped); inventory page refreshes on variant-only changes.

**Carried forward:** renaming a variant SKU counts as a new variant (it takes the stock shown in the form, not the old row's); Cloudinary upload timeout can leave an orphan file / delete is not atomic with the DB; media "in use" check is check-then-delete (no lock); public list runs one small category query + `count` per uncached request; public payloads include product/variant SKUs and internal ids (no stock counts); public list price filter/sort uses the product price, not variant prices; `clientIp` trusts `x-real-ip` (Stage 11); no browser/axe pass.
