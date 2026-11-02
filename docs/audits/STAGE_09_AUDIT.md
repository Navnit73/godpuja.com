# Stage 9 — Cart, checkout, orders: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only). The payment-gateway adapter is **BLOCKED on the owner's gateway decision**; this stage ships Cash on Delivery plus a generic signed webhook.

## Delivered (server + admin; the storefront cart/checkout UI is Stage 8's)
- `POST /api/cart/validate`, `POST /api/checkout` (Idempotency-Key), `GET /api/orders/:id?token=`, `POST /api/payments/webhook`.
- Admin API: orders list/detail, status transitions, payment status, notes, refunds (record-only), CSV export. Admin UI: `/admin/orders` (filters, pagination, export link) and `/admin/orders/[id]` (customer, items, pricing, addresses, payment, valid status actions, notes, refund form, history timeline). Nav entry "Orders".
- Models: `Order`, `Counter` (atomic monthly order numbers), `WebhookEvent` (idempotency). Provider slot `src/server/payments/provider.ts` with `cod`.
- Env: `SHIPPING_FLAT_PAISE` (5000), `FREE_SHIPPING_OVER_PAISE` (99900), `PAYMENT_WEBHOOK_SECRET`.

## Key decisions
- **Stock**: decrement is one guarded update per line (`stock >= qty`, or `$elemMatch` on the variant) inside the checkout transaction; any failure aborts the transaction, so a multi-line order is all-or-nothing and the loser of a race changes nothing. `timestamps:false` keeps product editors' versions valid. `soldCount` is incremented in the same update and decremented on cancel.
- **Idempotency**: unique `idempotencyKey` + stored `requestHash`. Replays (including 12 simultaneous submissions) return the original order; the same key with a different body is a 409 instead of a silent replay. A counter value may be burned by a failed/replayed attempt (gaps allowed, no reuse).
- **Cancel** restores stock in the same transaction as the compare-and-set on the status, so concurrent cancels restore once.
- **Refunds** are record-only with a compare-and-set loop on `refundedTotal` (can never exceed the total under concurrency). The webhook `refunded` event uses the same function.
- **Guest access** is the 192-bit `accessToken` (constant-time compare; wrong token = unknown order = 404, no admin fields in the view). No customer accounts yet.
- **Webhook**: HMAC over the raw body, ±5 min replay window, unique event id committed in the same transaction as the order change, `failed` never undoes `paid`, amount must match, same provider payment id cannot attach to two orders.
- CSV: formula characters (`= + - @`, tab, CR) are prefixed with `'`, which also applies to phone numbers starting with `+` (safe by default; the spreadsheet shows the apostrophe).

## Verification
- `tsc`, `eslint` clean. `tests/orders.test.ts`: **57 tests pass**, covering validation (phones, PIN codes, quantities, billing, mass assignment/client prices ignored, idempotency key), pricing/shipping rules (threshold edge, free-shipping product), cart validation (draft/archived/hidden-category/unknown, clamping, variants), checkout (stock, snapshots, price change after order, duplicate-line merge, variants, rejection leaves no side effects), **12 simultaneous same-key submissions → 1 order/1 decrement**, **8 concurrent buyers of the last unit → exactly 1 wins, stock 0**, 20 buyers for 5 units sell exactly 5, multi-line all-or-nothing under contention, variant contention, concurrent order-number generation, route contracts (201/200, 400, 429), token view, full status table, cancel restoring stock **once under 4 concurrent cancels**, cancel-vs-ship race, COD payment transitions, notes, refunds (partial/full, **6 concurrent refunds never exceed the total**), webhook (bad/missing/tampered signature, valid, duplicate, **10 simultaneous duplicates**, stale/future timestamp, amount mismatch, unknown order, failed→succeeded, late failed does not undo paid, refund events, shared payment id, oversize), admin list/search/filter/pagination (regex characters escaped), CSV output and formula escaping, `explain()` on all list/search/sort/lookup queries (no COLLSCAN; no in-memory sort for the main lists), permission matrix.
- Full suite result: see the report from the parent run.

## Not verified / carried forward
- **No live HTTP run of the admin order pages** and no browser/axe pass: `next build` currently stops on the parent's storefront page `/(store)/order/[id]/confirmation` (`useParams()` outside `<Suspense>`), which is outside this stage's files. Admin pages compile (`Compiled successfully`) and type-check.
- Payment gateway integration, online payments, payment retries and automatic refunds: pending the owner's gateway choice.
- Customer accounts / `/account/orders`, order confirmation e-mails and shipping notifications (Resend decided, not wired), discounts/coupons, tax breakdown (prices are tax-inclusive; `tax` is stored as 0).
- Rate limiting is per instance (Stage 11); `clientIp` trusts `x-real-ip`.
- Orders keep a product reference; deleting a product keeps the order intact (snapshots) but cancel cannot restore stock for it (skipped by design).
- Stock for `returned` orders is not restored automatically (goods may be unsellable); an admin adjusts inventory manually.
