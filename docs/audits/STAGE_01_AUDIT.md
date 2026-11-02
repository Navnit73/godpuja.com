# Stage 1 Audit — Setup, DB, Auth, Design Tokens

Date: 2026-11-02 · Auditors: implementer self-review (tests + live HTTP checks) and an **independent reviewer agent** that read the code without seeing the implementer's conclusions.

## Issues identified and fixed

| # | Severity | Issue | Root cause | Fix | Verified by |
|---|---|---|---|---|---|
| 1 | Medium | Login rate limit bypassable with spoofed `X-Forwarded-For` | First XFF entry is client-controlled; per-email key included IP | Use `x-real-ip` / last XFF entry; added IP-independent `login-email` cap (20/15 min) | `security.test.ts` (XFF), live curl with spoofed headers → 429 on 6th |
| 2 | Medium | Limiter map unbounded under unique-key flooding | Cleanup only removed expired entries | Hard cap 10k keys, evict oldest | flood test (25k keys) |
| 3 | Medium | Admin page trusted JWT role for up to 7 days | No DB check on pages | `currentUser()` (DB-backed, active only) used by `/admin`; `requireUser()` built on it | live: admin page 200 for active superadmin |
| 4 | Medium | Open redirect via `/\evil.com` in `next` param | Naive prefix check | `safeNext()` parses URL, rejects `\`, control chars, off-origin | 10 test cases |
| 5 | Medium | Test could `deleteMany` before DB-name check | Regex URI rewrite + late assertion | URI rewritten via `new URL`; hard abort in `beforeAll` before any delete | code + test run on `godpuja_test` |
| 7 | Low | `Origin: null` caused 500; Host-only comparison | Unguarded `new URL` | try/catch → 403; honour `x-forwarded-host` | test + live (`Origin: null` → 403) |
| 8 | Low | JWT role not validated against `ROLES` | Type cast only | Check against `ROLES` | test |
| 9 | Low | bcrypt ignores bytes past 72 | Schema allowed 200 chars | Register rejects > 72 bytes | test |
| 10 | Low | Seed script silent when email exists with wrong role | Message always "already exists" | Reports role/active state, exit code 1 | code review |
| 11 | Low | `/admin` redirect dropped `next` | — | Redirects to `/login?next=/admin` | code review |
| — | Medium | Email validated before trim (found by own tests) | Zod order | `trim().toLowerCase().pipe(email)` | test |
| — | High (build) | `/admin` failed prerender: `cookies()` outside Suspense (`cacheComponents` on) | Dynamic data in static shell | Moved into `<Suspense>` child | `next build` passes |

## Accepted / deferred

| Item | Decision |
|---|---|
| Registration returns 409 for existing email (enumeration, finding 6) | **Accepted for now**; limited to 5/min/IP. Revisit with email verification (Stage 9 email provider). |
| Token revocation (`tokenVersion`) and 7-day TTL (finding 3, remainder) | **Deferred to Stage 2** with the users module (deactivate/demote must invalidate sessions). Every admin page/handler must use `currentUser()`/`requireUser()`; `proxy.ts` stays a coarse gate. |
| Limiter is per-instance, in-memory | Deferred to Stage 11 (shared store before multi-instance deploy). `clientIp` assumes exactly one trusted proxy. |
| `handle()` logs prerender-time `cookies()` rejection as "unhandled error" during `next build` | Cosmetic (build succeeds). Revisit in Stage 2 when auth helpers are used by more routes. |
| `Secure` cookie flag only active when `NODE_ENV=production` | Verified by code only; dev runs on http. Check on staging HTTPS in Stage 12. |
| Route handlers not covered by automated HTTP tests | Verified manually via curl (below). Add Playwright/API tests in Stage 12. |
| `npm audit`: 16 moderate advisories in transitive dev deps | Not addressed; review in Stage 11. |

## Tests performed

- `vitest`: **33 passing** (permissions, password, JWT tamper/alg=none/expired/wrong-secret/unknown-role, validation, rate limit incl. expiry/flood/XFF, same-origin + error envelope, safeNext, User model against `godpuja_test`: unique email, lowercase, hidden hash, role enum).
- `tsc --noEmit`, `eslint`, `next build`: clean.
- Live HTTP against dev server: unauth `/admin` → 307 to login; `/api/admin/*` unauth → 401, customer → 403; bad password → 401 (generic message); validation → 400 with field errors; login sets HttpOnly SameSite=Lax cookie; `/me`; register ignores `role` and creates customer; cross-origin POST → 403; 6th login attempt → 429; logout invalidates cookie client-side.

## Final audit status

Stage 1: **AUDIT_COMPLETE** with the deferred items above tracked. No open high-severity issues.

## Required owner actions

1. Rotate the MongoDB Atlas password (it was shared in chat) and update `.env.local`.
2. Change the seeded superadmin password (default `ChangeMe!12345`).
