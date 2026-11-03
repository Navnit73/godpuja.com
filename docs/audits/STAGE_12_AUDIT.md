# Stage 12 — Global-ready foundations: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).
Scope source: [PRD v1.1](../PRD_v1.1.md) §5.4, §12, §13, §15.1; plan in [IMPLEMENTATION_PLAN](../IMPLEMENTATION_PLAN.md). Payment gateway deferred by owner (2026-11-03); COD remains the only method.

## Delivered

### Money with currency codes (§13)
- `lib/money.ts`: `BASE_CURRENCY = "INR"` (catalogue + accounting currency), `formatMoney(minor, currency)` using the currency's own minor digits (INR 2, JPY 0, KWD 3), `minorToDecimal` for exports, `isCurrency`. Integer minor units only, no float arithmetic.
- Every order stores `currency` (required, ISO 4217). Cart pricing, checkout result, customer and admin order views, the order list and the CSV export carry it. Checkout states "You pay in Indian Rupee (INR)" before the order is placed (§5.4 / §13).
- Webhook events may carry `currency`. A mismatch with the order is rejected (400) before anything changes.
- Fix found while testing: amounts with paise displayed as "₹199.5". Whole amounts now show no decimals ("₹100"), others show all of them ("₹199.50").

### International addresses (§13, §15)
- `lib/address.ts`: `Address.postalCode` replaces `pincode`; ISO 3166-1 alpha-2 `country`; per-country postal/state rules (IN, US, CA, GB, AU, NZ, SG, AE, HK, generic fallback); `allCountries()` from `Intl.DisplayNames` with non-countries (EU, UN, ZZ…) removed; `normalizeAddress` reads pre-Stage-12 rows; `addressLines` for display.
- **Shipping** is limited to `SHIPPING_COUNTRIES` (env, default `IN`). Another country is rejected with a field error before any stock is taken (§13: do not promise coverage that does not exist). **Billing** may be any country (NRIs paying for delivery in India).
- Checkout: country select (static text when only one shipping country), country-specific labels ("PIN code", "ZIP code", "Province"…). Country lists are built on the server at request time (`connection()` inside `Suspense`), so a changed env is never frozen into the prerendered shell and ICU differences between runtimes cannot cause a hydration mismatch.

### Order statuses (§5.4)
- Added `pending_payment`, `payment_failed`, `return_requested`, `refunded` (shared in `lib/order-status.ts` with labels).
- Providers declare `confirmsOnPlacement`. COD = true (unchanged behaviour). A future gateway = false, so its orders start `pending_payment` and only become `confirmed` when payment succeeds (webhook or admin "Mark as paid"). No order looks confirmed before it is paid.
- Admin transitions: unpaid orders can only be cancelled (stock returned); `delivered → return_requested → returned | delivered (declined)`. `confirmed`, `payment_failed` and `refunded` cannot be set by hand.
- Full refund of a cancelled/returned order moves it to `refunded`. The refund write is now compare-and-set on status as well as `refundedTotal`, so a concurrent cancel or return is never overwritten.

### Time zones (§13, §15.1)
- `lib/time.ts` (Intl only, no dependency): `isTimeZone`, `zonedToUtc`, `dayRangeUtc` (correct for 23/25-hour DST days), `localDay`, `zoneLabel`, `formatInZone` (always shows the zone, §6.4). Invalid dates such as `2026-02-30` are rejected (found while testing: they used to roll over silently).
- Admin order date filters use `ADMIN_TIMEZONE` (env, default `Asia/Kolkata`) instead of a hard-coded `+05:30`. These helpers are the base for temple slots (Stage 19).

### Roles and temple scope (§12, §15.1)
- Roles: `superadmin, admin, store_manager, content_manager, temple_ops_manager, temple_operator, provider_manager, booking_manager, support_agent, customer`, with labels in the admin.
- `editor → content_manager`, `manager → store_manager`. Old DB rows and existing session cookies keep working through `normalizeRole` (login, session verify, `resolveUser`, user list/filter). New writes must use the new names.
- Permission changes (deliberate, from PRD §12): store manager also gets `categories:write` and `media:write` (product images). Refunds stay admin-only. New Phase 2 permissions (`temples:*`, `bookings:*`, `providers:*`, `donations:*`) are defined and assigned now; their modules enforce them in Stages 18–22.
- `User.templeIds` and `server/auth/scope.ts` (`canAccessTemple`, `assertTempleAccess`, `templeFilter`). Temple operators are limited to their assigned temples. A request for another temple returns **404**, not 403, so operators cannot probe which temples exist (§21.1 #13). A scoped user with no temples matches nothing, never everything.
- Users API accepts `templeIds`. The admin form shows the scope note; assigning temples in the UI arrives with the Temples module (Stage 18).

### Data migration
- `npm run migrate:stage12` (dry run by default, `-- --apply` to write; idempotent): role renames, `pincode → postalCode` on user addresses and orders, `currency: "INR"` on old orders. The app reads unmigrated rows correctly, so it can run any time after deploy.
- Applied to the dev database `godpuja` on 2026-11-03: 1 order updated (currency + postal code), 0 users. A follow-up dry run reports nothing left to migrate.

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint src tests scripts` | clean |
| `vitest run` | **364 passed** (335 before + 29 new in `tests/stage12.test.ts`; 6 existing assertions updated for the new contract) |
| `next build` | passes; `/checkout` is a partial prerender with the country list rendered per request |
| Built app smoke (`next start`) | `/` and `/checkout` return 200 |

New tests cover: money formatting/decimals per currency; postal/state rules for 10 countries; country list hygiene; legacy address and currency reads (admin, customer view, CSV); DST-correct day ranges (London 23 h / 25 h days) and invalid dates; status table invariants (no hand-set payment statuses, no cancel after shipping); pending → failed → paid → confirmed via admin, and via webhook with currency check; cancel of an unpaid order returns stock; full refund → `refunded` only for cancelled/returned; return requested → returned / declined; admin day filter in `ADMIN_TIMEZONE`; role matrix (least privilege per PRD role); temple scope (own temple only, 404 on others, empty scope matches nothing); legacy session cookie and legacy DB role rows; templeIds create/update.

## Not verified / carried forward
- **Browser pass of the new checkout fields not run** (the form needs items in the browser cart; the HTTP smoke test only reached the empty-cart state). Run `npm run audit:a11y` / `audit:browser` at Stage 17. `scripts/browser-audit.mjs` still selects the old role names "editor"/"manager" in the users step; update it at Stage 17.
- Shipping rates and tax are not yet destination-dependent (Stage 14). Today only *whether* we ship is per country.
- Abandoned `pending_payment` orders hold stock until cancelled. An expiry job is needed once a gateway exists (Stage 13, with the gateway decision).
- Catalogue stays single-currency (INR); multi-currency display is Phase 3.
- `lib/format.ts` admin date display remains fixed to IST (matches the default `ADMIN_TIMEZONE`; switch it to `formatInZone` if the admin zone ever changes).
