# Stage 14, slice 2 — coupons and tax rules: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).
Scope source: [PRD v1.1](../PRD_v1.1.md) §5.4 (coupon validation, taxes and total, currency and all charges before payment), §13 (destination-dependent tax, no floats). Slice 14c (reviews, wishlist, recently viewed, deity/material/occasion filters) follows.

## Delivered

### Coupons
- Three kinds: **percentage** (whole percent, rounded down, optional cap), **fixed amount** (never more than the goods) and **free shipping**. Optional minimum order, start and end time, total uses, and uses per customer email.
- Customers enter a code in the cart or at checkout. The code is kept next to the cart in the browser and **re-checked by the server on every price**. A wrong code never breaks the cart; it shows a plain reason ("not valid", "not active yet", "expired", "fully used", "Spend at least ₹500…"). Unknown and switched-off codes give the same answer, so codes cannot be guessed.
- **Limits hold under concurrency.** The total-uses counter only increments while below the limit; the per-customer counter is a guarded upsert keyed by lower-cased email. Both run inside the order transaction, so a failed order (stock, validation) uses nothing, and six simultaneous checkouts for the last use produce exactly one order. A retry with the same Idempotency-Key never counts twice; a different code under the same key is refused.
- **Cancelling an order gives its coupon use back.**
- The order stores a snapshot of the coupon and discount, so editing or deleting a coupon never changes a past order.
- Admin **Coupons** page (store managers, admins): create, edit (code is locked), switch off, delete, with used/limit, validity dates and live/scheduled/expired/off status. Changes are audit-logged.

### Tax rules
- One rule per **destination country**: name (GST, VAT…), rate (to 0.01%), prices **include** the tax (reported, total unchanged) or tax is **added** at checkout, and whether shipping is taxed. A country without a rule has no tax line, so **nothing changes until the owner configures rates**.
- Tax is calculated on goods after discount (and shipping after discount when the rule taxes it), rounded half up once. The cart prices for the chosen delivery country, so the checkout total is exact before the customer pays, and the checkout states whether tax is included or added.
- Admin **Tax rules** page, for admins and superadmins only (finance-sensitive). Past orders keep their own tax figures.

### Everywhere money is shown
- One summary component (`PricingLines`) is used by the cart, checkout, order confirmation and the account order page: subtotal, discount (with the code), shipping, tax (name, rate, included or added) and the total with its currency. The admin order page, invoice and order emails show the same lines.

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint src tests scripts` | clean (two real findings fixed: a helper named like a React hook, and a clock read during render) |
| `vitest run` | see result below the table |
| `next build` | passes |
| Browser (Chrome headless, built app, **test** database; shopper at 390 px, admin at 1280 px) | **35/35 checks**: bad code explained; valid code applied with the right discount and total (2 × ₹499 − 10% + ₹50 = ₹948.20, GST ₹42.77 included); code kept into checkout and cleared after the order; confirmation and order email show the discount; the same email using the code again is refused at the coupon field; admin creates, rejects 150%, locks the code, edits and deletes a coupon; admin order shows discount and tax; tax rule edit rejects a bad rate, then switches India to added tax; checkout then shows "GST 18%" and "GST is added to the total"; both flows fit 390 px; no console errors; axe (WCAG 2.1 A/AA) clean on the cart, checkout, confirmation and every new admin page and form state |

New tests (`tests/stage14b.test.ts`, 38): discount maths for each kind (caps, floors, never above the goods); tax maths (inclusive, exclusive, shipping, rounding half up, no rule); **500 random carts** where the total always adds up with whole numbers and no negatives; every reason a code can fail; input validation; permissions (store manager runs coupons, only admins touch tax); pricing a cart (no code or rule changes nothing, bad code explained, inclusive vs exclusive, discount lowers the tax base, switched-off rule ignored); orders (discount, tax and coupon snapshot recorded, charged exactly what the cart showed, bad code takes no stock, a failed order does not use up the coupon, per-email limits in any letter case, **six racing checkouts for the last use give one order and no stock lost**, the same customer racing themselves gets one use, idempotent retry, dates and minimum, free shipping); cancel returns the use and never below zero; admin CRUD (duplicate, stale version, locked code, delete clears counters); tax rule CRUD (one per country, stale version, locked country, past orders keep their figures).

## Bugs found and fixed during the stage
- Editing a coupon with a changed code and a current version was **silently accepted with the code ignored**. The code is now part of the match, so a rename is refused with a message.
- Lint flagged `useKey` (a helper named like a React hook) and a `Date.now()` during render in the coupons table; the state (live, scheduled, expired, off) is now computed on the server.

## Not verified / carried forward
- **Tax rates and rules are the owner's to enter** (and to confirm with an accountant). Nothing is pre-filled. Tax is by destination country only: no state-level or per-category rates (India's GST differs by product type), and no tax-exempt customers.
- **Shipping is still one flat rate and free-over threshold** for every country. Destination-dependent shipping rates are worth adding before a second country is switched on in `SHIPPING_COUNTRIES`.
- A coupon is for the whole order (not specific products or categories) and one code per order.
- The per-customer limit counts by email, so a determined customer can use another address; per-account limits would need accounts to be mandatory.
- The tax-added total for a gateway order will matter when a payment gateway arrives: the amount sent to the gateway is the order total (including added tax), which the webhook amount check already compares against.
