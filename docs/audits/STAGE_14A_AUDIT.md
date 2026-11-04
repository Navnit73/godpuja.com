# Stage 14, slice 1 — `/shop` URLs, tracking, returns, invoices: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).
Scope source: [PRD v1.1](../PRD_v1.1.md) §3.1, §5.4. Slices 14b (coupons, tax rules) and 14c (reviews, wishlist, recently viewed, deity/material/occasion filters) follow.

## Delivered

### `/shop` URLs (§3.1)
- `/shop` lists every product (with a category list); `/shop/<category path>` is a category page (breadcrumbs, subcategories, filters, sort, pagination, canonicals, JSON-LD all moved over). Products stay at `/product/<slug>`.
- **Nothing breaks**: every `/category/...` URL gets a permanent 301 to `/shop/...` in the proxy (query string kept). Redirects stored by earlier category moves are followed straight to `/shop/...` in one hop. New category moves record `/shop/...` redirects. Sitemap lists `/shop`. "Shop (all products)" is a menu/footer link option. `npm run migrate:stage14` rewrites stored `/category/` redirects (dry run on dev: 0 to change).
- URLs are built in one place (`lib/shop-url.ts`).

### Shipment tracking
- Admin order page: a "Shipments & tracking" card. Pick a carrier, enter the number (validated), optionally an `https` tracking page for carriers without a deep link. Allowed while processing, shipped or delivered. Duplicate numbers are refused; mistakes can be removed. The customer is emailed the tracking and sees it on their order (account and guest link).
- Links are built only for carriers whose tracking URL takes the number (Delhivery, DHL, FedEx, UPS). Anything else shows the number, or a staff-supplied `https` page. `javascript:`, `http:` and other schemes are never linked.

### Customer cancel and return
- **Cancel** (signed-in owner): while the order is pending payment, payment failed or confirmed. Stock returns exactly once, the customer is emailed, and the order history records who did it.
- **Return**: delivered orders, within `RETURN_WINDOW_DAYS` of the recorded delivery date (default 7; 0 turns it off), once per order, with a reason. The order moves to "return requested"; staff see the reason on the order and **Accept return** or **Decline return** (with a note). The customer is emailed the decision. A declined return cannot be requested again. Staff can also record a return themselves.
- New order field `deliveredAt` starts the window. Orders delivered before this stage have no delivery date, so they offer no online return (staff can still record one).
- One function (`orderActions`) decides what a customer may do; both the page and the API use it. All writes are compare-and-set on status, so double clicks and simultaneous requests record once.

### Invoice
- `/account/orders/<id>/invoice`: owner only, printable (the site header, footer and menus are hidden when printing), for confirmed orders onward (not for unpaid or cancelled ones). Seller name, address and tax registration number come from `SELLER_NAME`, `SELLER_ADDRESS`, `SELLER_TAX_ID`; the tax number is printed only when set. A tax line appears when an order carries tax (slice 14b).

## Bug found and fixed (from Stage 13)
- **Every `/account` page scrolled sideways on phones** (431 px wide on a 390 px screen): the scrollable tab list sized the whole grid column to its content. Fixed with `grid-cols-1` and `min-w-0`. My Stage 13 overflow check ran on a page without that layout, so it missed it; this stage's browser run covers the account pages.
- A Stage 12 test depended on today's date (found when the date rolled over); fixed in Stage 13's commit.

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint src tests scripts` | clean |
| `vitest run` | see result below the table |
| `next build` | passes |
| Browser (Chrome headless, built app, **test** database; customer at 390 px, admin at 1280 px) | **32/32 checks**: `/shop` and category pages render and pass axe; `/category/...?sort=...` redirects with its query; unknown category is a real 404; customer cancels an order (option and invoice then disappear); short return reason rejected, valid one recorded; invoice renders and passes axe; **print view hides site chrome but keeps the invoice**; admin sees the reason, declines with a note; customer sees the note and no second return offer; tracking number validated, added, link correct, visible to the customer; account order page fits 390 px; no console errors; axe (WCAG 2.1 A/AA) clean on every new or changed page |

New tests (`tests/stage14a.test.ts`, 21): legacy URL mapping; tracking links (encoding, https only, no `javascript:`); shipment and return validation; what a customer may do (cancel early, one return inside the window, declined stays declined, no window when no delivery date); proxy redirects (with query, stored legacy redirects in one hop, `/shop` and real categories served, unknown 404, `/account` gated, new moves recorded under `/shop`); shipments (states, duplicates, removal, history, email, both customer views); delivery date recorded and kept on a declined return; staff-recorded returns; the full customer return flow (request, history, email, decline, no re-request, no duplicate "delivered" email); expired window, undelivered order, other people's orders; four simultaneous requests record one; customer cancel (stock restored once, one email, refused once processing, other people's and guest orders 404); the guest view never carries account-only actions.

## Not verified / carried forward
- **Carrier tracking URL templates are not checked against the live carrier sites** (no network in the test run). Check the four deep links once with a real tracking number.
- Accepting a return does **not** refund or restock automatically; staff record the refund and adjust stock. This is deliberate until the payment gateway exists.
- Guests cannot cancel or return from the confirmation link (account required); they can contact support. Guests also have no invoice view.
- Returns are for the whole order (no per-item returns).
