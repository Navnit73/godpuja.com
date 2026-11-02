# Full Audit — Stages 1–3 (cross-cutting)

Date: 2026-11-02. Three independent checks: (1) a fresh code reviewer focused on cross-stage problems, (2) a **real-Chrome browser audit** (`npm run audit:browser`: 52 checks across desktop 1280px, phone 390px and a customer session, with axe WCAG 2.x A/AA + best-practice scans, console/network error capture, overflow detection and screenshots), (3) the existing suite (111 tests), `tsc`, `eslint`, `next build`, `npm audit`.

## Result

**0 open errors.** Browser audit: 52 passed, 0 findings. Tests 111/111, typecheck, lint and production build clean. `npm audit --omit=dev`: 0 vulnerabilities.

## Found and fixed

| # | Sev | Finding | Source | Fix |
|---|---|---|---|---|
| 1 | **High** | **Production build was broken** by my homepage change (`/` read the DB during prerender) | Build after change | Homepage renders at request time around the cached read |
| 2 | High (a11y) | Brand colour failed WCAG AA: white on `saffron-600` 3.7:1 (buttons, links, 5 pages); gold focus ring < 3:1 | Browser axe + reviewer | `primary` → `saffron-700` (5.6:1), hover `saffron-800`, `accent`/ring → `gold-600`; DESIGN_SYSTEM updated |
| 3 | Med | Mobile drawer: after Esc, focus did not return to the menu button (page behind was still `inert` when `focus()` ran) | Browser | Focus restored in an effect after `open` flips |
| 4 | Med | No `not-found`, `error`, `global-error` pages (unstyled framework defaults) | Reviewer | Branded pages added using tokens |
| 5 | Med | Only `/preview/*` had security headers; admin/login frameable | Reviewer | Global `nosniff`, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, HSTS (prod), `poweredByHeader: false` |
| 6 | Med | Customer logging in at `/login` bounced back to `/login` silently; signed-in users saw the form | Reviewer | Customers go to `/`; `/login` redirects signed-in users |
| 7 | Med | Per-account login limit counted successful logins (anyone could lock out an admin email) | Reviewer | Failures-only counter (`rateLimitPeek` + `rateLimit` on failure) |
| 8 | Med | Public `/api/auth/register` had no UI yet was live | Reviewer | Closed by default (`ALLOW_PUBLIC_REGISTRATION`) |
| 9 | Low | Public pages/404/home lacked `<main>`; home had no `<h1>` | Reviewer + axe | `<main>` in `PageView`, sr-only h1 on placeholder home |
| 10 | Low | Design-system drift: `.card` radius, arbitrary grid value, missing line-heights, no global focus ring, spacing/container values not documented | Reviewer | CSS fixed; doc made to match reality |
| 11 | Low | Docs vs code mismatches (`?sort=`, "planned", `tokenVersion`, page `category`, A6 wording, `locks` collection) | Reviewer | All corrected |
| 12 | Low | API gaps: no content-type/size check; unknown `/api/*` returned HTML 404; login page `follow`; no `metadataBase` | Reviewer | JSON-only + 1 MB cap; JSON 404 catch-all; fixed |
| 13 | Low | `/admin` gate dropped the deep link for stale sessions | Reviewer | Proxy forwards the requested path; gate redirects with it |
| 14 | Low | Hygiene: stock README (wrong fonts), no `engines`, unused `playwright-core`/`axe-core`, unlabelled Cloudinary env | Reviewer | README rewritten, `engines`, `audit:browser` script, `.env.example` comments |
| 15 | — | **Homepage showed only the placeholder** | Owner question | Published CMS page `home` now renders at `/`; `/home` 308-redirects to `/`; canonical is the site root |

## Accepted / deferred (not errors)

| Item | Reason |
|---|---|
| Logout only clears the cookie (stateless sessions); a copied cookie lives until expiry (7 d) or a role/active/password change | Documented in API doc. Revisit with shorter TTL or session store in Stage 11. |
| 16 `npm audit` advisories | All dev-only ESLint toolchain (`minimatch` ReDoS); never shipped; npm's suggested "fix" downgrades ESLint to v4. Production deps: 0. |
| Unknown/unpublished URLs return HTTP 200 (soft 404); no 301 on slug change; malformed `%` URLs return 500 | Stage 10 proxy work (see Stage 3 audit). |
| Per-instance page cache invalidation; in-memory rate limiter | Deployment decision, Stage 11 (ARCHITECTURE A16). |
| Unreferenced `public/` brand assets, `prd.md` alongside `PROJECT_PRD.md` | Intentional; explained in README. |

## Browser-audit notes

- Visual review of key screens (users, editor, modal, drawer, public page) found a coherent layout; no overflow, no console errors.
- The audit script was itself debugged during this pass (ambiguous labels, prefetch aborts, a transient mid-transition opacity sample). None were product defects.
- Not yet covered: multi-user concurrency in the UI, Safari/Firefox, screen-reader testing, and the storefront navbar/footer (not built until Stages 4–5).
