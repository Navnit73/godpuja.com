# Stage 11 — Performance, security, accessibility: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).

## Delivered

### Security
- **Content-Security-Policy** on every response (`next.config.ts`): `default-src 'self'`, scripts `'self' 'unsafe-inline'` (no `unsafe-eval` in production), images self/data/blob/https, `connect-src 'self'`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Static rather than nonce-based because `cacheComponents` prerenders shells that cannot carry a per-request nonce (ARCHITECTURE A17). Added `Cross-Origin-Opener-Policy: same-origin`. `upgrade-insecure-requests` and HSTS are emitted **only when `SITE_URL` is https at build time**. Sending them on a plain-http origin made the browser rewrite navigations to `https://` and broke the site (found in this stage's browser run).
- **Shared rate limits** (MongoDB `rateLimits`, atomic fixed-window `$inc` upsert, TTL) for login (all three keys, including the failure-only account lockout), registration, checkout and newsletter. They now hold across instances. High-volume reads keep the in-memory limiter (documented per instance).
- **Trusted-proxy client IP**: `X-Real-IP` was trusted unconditionally before; now the IP is the X-Forwarded-For entry added by the trusted proxy (`TRUSTED_PROXY_HOPS`, default 1) or a configured edge header (`CLIENT_IP_HEADER`). Spoofed entries are ignored.
- **Search rate limit** (PRD §10): 30 searches/min per client on `/search`, with a friendly message.
- **Audit log** (PRD §10): user create/update are recorded in `auditLogs` (actor, action, target, changed field names only, IP). Orders already had an actor-stamped history.
- Body-size checks: already in place since Stage 1 (`readLimited`, 1 MB JSON / 5 MB upload / 64 kB webhook); reviewed, no change.
- `npm audit --omit=dev`: **0 vulnerabilities**.

### Performance
- `scripts/seed-bench.ts`: separate `godpuja_bench` database, 1,000 active products, 50 categories (3 levels), homepage with 3 rails.
- `scripts/bench.mjs`: page TTFB and API total time, p50/p95/max, distinct IPs so rate limits do not distort results, plus a 20-parallel-request smoke test.
- **Round-trip reduction** (the API cost was almost entirely sequential DB round trips to remote Atlas: ping 97 ms, query execution ~1 ms per `explain`): new in-process category snapshot (`services/category-snapshot.ts`, 10 s TTL, cleared on every category write; cart/checkout read fresh). List requests went from 3 sequential round trips to 1, cold product detail from 4 to 1.
- Index review (`explain`): search uses the text index (400 candidates examined, 1 ms); price + popular uses `{status, effectivePrice}` (87 keys / 87 docs, 1 ms); no collection scans.
- **Images**: Cloudinary URLs get `f_auto,q_auto,c_limit,w_N` transforms and `srcset`/`sizes` (`lib/image.ts`); LCP images (hero, product main photo) use `fetchpriority="high"`; other hosts are unchanged (A20).
- **Bundle analysis** (`scripts/bundle-report.mjs`, JS a modern browser actually downloads, gzip): storefront pages **~140 kB** (home/category/search 139.5, product 141.3, cart 141.9, checkout 143.7), of which ~130 kB is the React/Next runtime; **no admin code** (dnd-kit, react-hook-form, editors) on any storefront page. `/login` is 183 kB (form + validation libraries); acceptable for a non-shopping page. The 38 kB legacy polyfill chunk is `noModule` and not downloaded by modern browsers.

### Accessibility
- `scripts/a11y-audit.mjs`: axe (WCAG 2.1 A/AA + best practice), CSP violations, console errors, horizontal overflow and a first-Tab focus check on **11 storefront URLs × desktop/mobile, the shopping flow (add to cart → cart → checkout validation), 17 admin pages desktop and 6 admin pages mobile = 52 scans**.
- Fixed: skip link to `#main` on every page (WCAG 2.4.1); product listings got an `h2` (heading order); search vs. sort/filter forms are now distinct, named landmarks; checkout moves focus to the first invalid field after a failed submit; **form control borders raised to 3.3:1+** via a new `input-border` token (was 1.4:1, failing WCAG 1.4.11; DESIGN_SYSTEM updated).
- `tests/contrast.test.ts`: 17 token pairings checked from `globals.css` (text 4.5:1, focus ring/control edges 3:1). All pass, and a future token change that breaks contrast will fail the tests.

### Bug found and fixed (from Stage 8/9)
- **Products without variants could not be checked out**: the browser cart stores `variantSku: null`, the server schema accepted only a string or absent, so `/api/cart/validate` and `/api/checkout` returned 400 "Invalid input". The schema now treats `null` as absent; regression test added. Stage 9 tests missed it because they omitted the field instead of sending `null`.

## Verification
- `tsc`, `eslint .`, `next build` clean. **15 test files, 313 tests pass** (new: `tests/stage11.test.ts` 13 — IP selection incl. spoofing, shared limiter atomicity under 30 parallel calls / TTL / peek, category snapshot visibility + cache/invalidation, audit log content, image URLs; `tests/contrast.test.ts` 17; checkout `null` variant regression).
- Live (production build, bench DB, `next start`): headers present (CSP, nosniff, DENY, COOP, Referrer-Policy, Permissions-Policy; HSTS + upgrade only in the https build, confirmed in `routes-manifest.json`); login 401 ×5 then **429 with `Retry-After`**; spoofed left X-Forwarded-For entry and `X-Real-IP` do not escape the limit; 31st search shows the limit message while another client is unaffected.
- **a11y sweep: 0 findings** (axe clean on all 52 scans, no CSP violations, skip link is the first Tab stop everywhere, checkout errors linked via `aria-describedby` and focused).
- Earlier-stage browser audit (`scripts/browser-audit.mjs`) rerun as a regression check under the new CSP: users/pages/preview/customer/sign-out flows pass. Remaining items are expected: two console 404s from its deliberate missing-page visit (real 404s since Stage 10), and "CMS home page not shown at /" (Stage 7 made homepage sections take precedence over the CMS `home` page; that check predates it).

### Benchmark (PRD §9) — 1,000 products, `next start` on this machine, Atlas remote (ping 97 ms)
p50 / p95 in ms, 60 sequential runs per case. Run 1 before the round-trip work; runs 2–4 after.

| Case | Target (p95) | Run 1 (before) | Run 2 | Run 3 | Run 4 |
|---|---|---|---|---|---|
| home | < 200 ms TTFB | 2 / 3.4 | 1 / 1.7 | 1 / 1.6 | 1 / 2.1 |
| category (top level) | < 200 ms TTFB | 2.3 / 3.6 | 5.1 / 6 | 5.2 / 6.3 | 5 / 5.8 |
| category (leaf) | < 200 ms TTFB | 2.2 / 4.1 | 4.9 / 5.5 | 4.6 / 6 | 4.7 / 6 |
| category page 2 | < 200 ms TTFB | 2.5 / 4.2 | 5 / 6.8 | 4.5 / 6.4 | 4.7 / 5.9 |
| product detail (warm) | < 200 ms TTFB | 2.2 / 4 | 5.2 / 6.2 | 4.8 / 5.8 | 4.7 / 5.9 |
| CMS 404 | < 200 ms TTFB | 2.1 / 3 | 0.9 / 1.4 | 0.9 / 1.2 | 1.1 / 1.7 |
| sitemap.xml | < 200 ms TTFB | 1.4 / 3.2 | 0.8 / 1.7 | 0.7 / 1.8 | 0.9 / 1.7 |
| API list (newest) | < 150 ms | 273 / 336 ✗ | 107 / 113 | 106 / 123 | 106 / 118 |
| API list (category, price asc) | < 150 ms | 400 / 434 ✗ | 108 / 114 | 106 / 115 | 108 / 113 |
| API list (price filter, popular) | < 150 ms | 291 / 341 ✗ | 108 / 115 | 107 / **178 ✗** | 108 / **173 ✗** |
| API search | < 150 ms | 284 / 325 ✗ | 108 / 149 | 109 / **258 ✗** | 108 / 115 |
| API detail (cold, distinct products) | < 150 ms | 481 / 511 ✗ | 107 / 148 | 108 / 130 | 109 / 144 |
| 20 parallel API list (wall) | — | 1373 | 818 | 841 | 448 |

**Result: page TTFB target met by a wide margin. API target met at p50 in every case and at p95 in most runs, but not reliably.** The price-filter list was over at p95 in 2 of 3 post-change runs, and search in 1. Every API call is now a single round trip, so ~107 ms of each number is the 97 ms network ping to Atlas; the tail is jitter on the two parallel round trips (items + count). Server-side query time is ~1 ms. Page TTFB measures the prerendered shell; dynamic content streams after it.

## Known limitations / carried forward
- **Re-run `npm run bench` from a host in the same region as the Atlas cluster (Stage 12 staging).** Results from this machine are bounded by the network round trip and do not certify the API p95 target either way.
- `script-src 'unsafe-inline'` remains (required without nonces; A17). Revisit if Next supports nonces with prerendered shells or hash-based CSP leaves experimental.
- Per-instance pieces (proxy route caches, category snapshot, in-memory limits, `"use cache"`) assume the single-instance deployment in A16. **Owner to confirm the hosting choice.** Scaling out needs a shared cache handler.
- `SITE_URL` must be the production https origin **at build time** (HSTS / upgrade-insecure-requests, canonicals, sitemap).
- Audit log has no admin viewer yet (`auditTrail()` exists); add at Stage 12 if wanted.
- Full keyboard walk-through of every admin editor (drag-and-drop alternatives, modals) was covered by Stage 2–7 checks and the regression script; screen-reader testing (NVDA/VoiceOver) not performed.
- `scripts/browser-audit.mjs` "CMS home at /" check is outdated since Stage 7; update or drop at Stage 12 when moving to Playwright tests.
