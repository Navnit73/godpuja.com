# Stage 8 — Storefront: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only). Built in parallel with Stage 9 against an agreed API contract.

## Delivered
- `/category/<path>`: breadcrumbs, description, subcategory links, product grid; sort (newest / popularity / price), price range in rupees, pagination; 404 when the category or any ancestor is hidden; SEO metadata + canonical.
- `/search?q=`: same listing; results are `noindex`; one-character queries show a hint.
- `/product/<slug>`: gallery with thumbnails, price/sale, variant picker (out-of-stock options disabled), quantity, add to cart, attributes, sanitised description, related products, breadcrumbs with real category names, SEO/OG metadata.
- Related products: same category by best sellers, topped up with featured; `GET /api/products/:slug/related`.
- Header: Search link and a live cart count (works across tabs).
- Cart: kept in the browser (no account needed), always priced and stock-checked by `POST /api/cart/validate`; unavailable lines are flagged with a remove action; quantities are clamped to stock.
- Checkout: guest form (contact, shipping, optional billing, Cash on Delivery), server-side validation errors mapped to fields, an `Idempotency-Key` reused across retries so a network failure cannot create a second order; clears the cart and goes to the confirmation page.
- Confirmation page `/order/<id>/confirmation?token=`: token-gated, `no-referrer`, `noindex`, `no-store`.
- `ProductCard` extracted and shared by homepage rails, listings and related products.

## Decisions
- Listing filters are a plain GET form (works without JavaScript); invalid URL values are dropped, never a 500.
- Category and search listings are not cached (unbounded parameter space) but use indexed, bounded queries; product detail uses the cached reader.
- Customer accounts are not part of this release (registration is closed); orders are reached through the token link.

## Verification
- `tsc`, `eslint`, `next build` clean. `tests/storefront.test.ts` (6): listing query parsing (rupees→paise, bad values ignored, forced category scope), link building, category page visibility through ancestors, breadcrumbs, related products ordering and exclusions. Combined suite with Stage 9: **12 files, 272 tests pass**.
- Live run (test DB, `next start`): category page (with sort + price filter), search (and the 1-character hint), product page, cart and checkout pages all render with the right `<title>`/`<h1>`; browse → validate cart → checkout → confirmation page works end to end (see Stage 9 report for the order-side checks). Fixed during integration: the confirmation page read URL params outside `<Suspense>`, which broke `next build`.

## Not verified / carried forward
- Browser pass + axe on the storefront pages (Stage 11/12).
- Unknown category/product URLs render the 404 page with HTTP 200 (same known limitation as CMS pages; fixed with redirects/404 status in Stage 10).
- Images are plain `<img>` (move to `next/image` with Cloudinary in Stage 11).
- JSON-LD product/breadcrumb data is Stage 10.
