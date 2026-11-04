# Stage 13 — Customer accounts, notifications, payment ledger: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).
Scope source: [PRD v1.1](../PRD_v1.1.md) §5.4, §11, §14.1, §15, §16; plan in [IMPLEMENTATION_PLAN](../IMPLEMENTATION_PLAN.md). **Payment gateway deferred by owner**: COD stays the only method. The gateway adapter and abandoned-payment expiry move to when a gateway is chosen.

## Delivered

### Customer accounts (§11)
- **Sign-up** `/register` (open by default; `ALLOW_PUBLIC_REGISTRATION=false` closes it). Role is never taken from the request. The user is signed in at once and a verification email is sent.
- **Email verification**: single-use 256-bit token (only its SHA-256 is stored), 24 h, void if the account email changed. The `/verify-email` page uses the token only on a button press (POST), so email security scanners that open links cannot burn it. Verifying **claims past guest orders** placed with that email.
- **Password reset** `/forgot-password` → `/reset-password`: same answer whether or not the account exists (no enumeration), 1 h single-use link, rate limits per IP and per email. Resetting signs out every session (`tokenVersion`), verifies the email, revokes other reset links, claims guest orders, and signs this browser in.
- **Google sign-in** (OIDC authorization code + PKCE S256 + state + nonce, with `jose`; no auth library). The ID token is verified against Google's JWKS (issuer, audience, expiry, nonce, `email_verified`). It links to an existing *customer* with the same email. **Staff accounts can never be entered through Google**, including a customer promoted later. Hidden unless `GOOGLE_CLIENT_ID/SECRET` are set.
- **/account** (proxy-gated, re-checked against the database on every page):
  - **Overview**: verify banner with "send a new link", recent orders, summary.
  - **Orders**: paginated history and order detail. Another user's order returns 404.
  - **Addresses**: up to 10, one default, country-aware form, notice for countries we do not ship to.
  - **Profile & security**: name, phone, country, language, preferred currency (display only), time zone, change or set password.
- **Checkout signed in**: email and default deliverable address prefilled, saved-address picker, "Save this address to my account". The order is linked to the account. The session is read from the request's own cookie header.
- **Login page**: "Continue with Google", readable `?error=` messages, links to sign-up and forgot password. Customers return to where they came from (never into `/admin`). The account menu has "My account" and "My orders".

### Notifications (§15, §16)
- Resend over its HTTP API (no SDK; `RESEND_API_KEY`, `EMAIL_FROM`). Without config, emails are logged `skipped` and printed in development, so links still work locally.
- Sent in `after()` (after the response), so email never slows or fails checkout or admin actions. The `notifications` delivery log stores template, recipient, record ref and state, with **no bodies or links**.
- Templates: verify email, password reset, order placed (or "waiting for payment"), status changes customers care about (confirmed/shipped/delivered/cancelled/returned/refunded), refund. Internal admin status notes are never emailed. HTML escapes all customer text, and every email has a plain-text part.

### Payment ledger (§14.1, §15.1)
- `payments` collection: one immutable row per charge or refund (`kind: order|booking|donation`, amount/fee/tax/net in minor units, currency, provider ref, actor). Update operations are blocked in the model.
- Written in the **same transaction** as the order change: admin "Mark as paid" (now transactional), admin refunds, webhook charge (with provider reference, unique per type) and webhook refund. `ledgerTotals` gives charged/refunded per currency for reconciliation. The admin order page shows the ledger and whether the order belongs to an account.

## Bugs found and fixed during the stage
- Mongoose 9 rejects aggregation-pipeline updates unless `updatePipeline: true` is passed. Added to every pipeline update.
- Values inside pipeline updates are read as field paths when they start with `$`. A **bcrypt hash starts with `$2b$`**, and customer address text could too. All such values are wrapped in `$literal`, with tests that store `"$where: 1 Temple Rd"` and check the hash is stored intact.
- Removing an address that is not yours reported success, because `modifiedCount` is always 1 when timestamps bump `updatedAt`. It now matches on the address id and checks `matchedCount`.
- The webhook's internal refund path returned a fake value through a cast. Refund logic is split into `applyRefund` (inside the caller's transaction) and `refundOrder` (admin).

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint src tests scripts` | clean |
| `vitest run` | **394 passed** (364 before + 30 new in `tests/stage13.test.ts`) |
| `next build` | passes; all account/auth pages are partial prerenders with per-request content |
| Browser (Chrome headless, 390 px, built app on the **test** database) | **34/34 checks**: sign-in redirect; register validation and success; verify banner; verification email → confirm; address modal validation and save as default; signed-in checkout prefill + currency disclosure + order; account orders list/detail; order email; profile save; wrong current password; forgot → reset → signed in; reset link single use; no horizontal overflow; no console errors; **axe (WCAG 2.1 A/AA) clean on 12 pages** |

New tests cover: token single use (also under 5 parallel uses), kind, expiry and hashing; registration (role ignored, cookie, verification email, duplicate 409); verification claims only matching guest orders; links void after an email change; one live verification link; password reset (no enumeration, disabled accounts, session revocation, hash integrity, other links revoked); password change (current required, Google-only can set); profile preference validation; addresses (default rules, cap of 10, literal `$` text, other users 404); signed-in checkout (order linked, address saved once, guest stays guest, revoked session ignored); Google ID token (valid, wrong nonce/audience/issuer/expiry, unverified email), flow cookie (PKCE, tamper), callback state mismatch and cancel (no network call); Google accounts (create, re-sign-in, link customer, conflicting Google id, staff refused incl. promoted and disabled); ledger (charge/refund rows, immutability, failed refund leaves no row, webhook charge recorded once with provider ref, totals); notifications (placed + customer-relevant statuses only, no duplicate on checkout replay, no body stored); Resend success/HTTP error/network error.

## Not verified / carried forward
- **Real Resend and Google not exercised** (no credentials). Both are covered with mocked HTTP and locally signed tokens. Before launch: set the four env vars, verify the sending domain in Resend, register `<SITE_URL>/api/auth/google/callback` in Google Cloud, and do one real sign-in and one real email.
- No retry for failed emails (state `failed` is logged; a retry job can read the log later).
- Changing the account email is not offered (not required by the PRD); support can do it in the database.
- Payment gateway adapter and expiry of abandoned `pending_payment` orders: when the owner picks a gateway.
- Account order history shows dates in IST, like the rest of the site; using the profile time zone comes with localisation (Phase 3).
