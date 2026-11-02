# Stage 5 — Footer: verification report

Status: **AUDIT_COMPLETE** (independent read-only review by a separate agent; no High findings; items below fixed or carried forward).

## Delivered
- `Footer` singleton model, `Subscriber` model, service, admin API (`GET/PUT /api/admin/footer`), public `GET /api/footer`, `POST /api/newsletter`.
- Admin editor `/admin/footer`: columns with links (reorder/hide/remove), contact, social, newsletter block, legal links, copyright.
- Storefront footer in the `(store)` layout (columns, contact, social, newsletter form, legal links); renders nothing until a footer is saved.
- Page changes also revalidate the `footer` tag; menu and footer share one live-page resolver.

## Decisions
- Reordering uses up/down buttons (no drag and drop): lists are short and buttons are keyboard/touch accessible.
- Newsletter only *captures* addresses (idempotent upsert, rate limited, honeypot). Sending and unsubscribe arrive with the email provider (Stage 9). No admin list/export of subscribers yet.
- Social links: https only, fixed platform list, shown as text links (no icon dependency).
- First save is create-only via the unique `key`; later saves use `updatedAt` optimistic concurrency.

## Verification
- `tsc`, `eslint`, `next build` clean; Vitest 155 tests pass (new `tests/footer.test.ts`: validation, concurrency incl. simultaneous saves, public resolution, newsletter idempotency under concurrency, permissions).
- Live run on the test DB: footer `null` before save; PUT then homepage HTML shows columns, contact, social, newsletter, legal links, current-year copyright; stale PUT 409; unauthenticated PUT 401; newsletter 200 / invalid email 400 / honeypot 200 without storing / 429 after 5 requests per minute.
- Found and fixed during verification: `/api/footer` was prerendered at build time (read the DB during `next build`); it now reads at request time.

## Not verified / carried forward
- Browser pass + axe of the footer and editor (Stage 11/12).
- `next build` logs two "unhandled error … prerendering" lines from `handle()` for `/api/auth/me` and `/api/footer` (it logs Next's prerender-abort signal). Harmless but noisy; `handle()` should rethrow that signal (Stage 11 cleanup).
- Rate limiter is per instance (Stage 11). Subscriber admin view/export and unsubscribe are not built.

## Independent audit findings (2026-11-02)
Fixed: (M) concurrent identical subscribes could return 500 (duplicate-key race) — now treated as success, tested with 20 simultaneous requests; (L) success message not announced / focus lost — focus moves to the status message; (L) honeypot renamed (less autofill-prone), oversize honeypot input no longer rejected; (L) social URL length cap; (L) phone needs ≥5 digits; (L) a database failure in the header/footer no longer errors the whole page (logged, chrome omitted); (L) footer loading shell closer to real height.
Carried forward: (M) `clientIp` trusts `x-real-ip` and shares an `"unknown"` bucket without a proxy, per-instance limiter — make the trusted header configurable + shared store (Stage 11); (M) no double opt-in / consent proof / cap on unconfirmed rows — build with the email provider (Stage 9) before any mailing, and before launch for DPDP/GDPR; `Content-Length`-only body limit (Stage 11); per-platform host check for social links (optional); route-level tests (Stage 12).
