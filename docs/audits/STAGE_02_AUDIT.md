# Stage 2 Audit — Admin Shell, UI Kit, Users & Roles

Date: 2026-11-02 · Auditors: implementer (tests, live checks on a production build) + **independent reviewer agent** (code read, no knowledge of implementer conclusions). Also closes the Stage 1 carry-over: session revocation.

## Issues identified and fixed

| # | Sev | Issue | Root cause | Fix | Verified by |
|---|---|---|---|---|---|
| 1 | High | Two superadmins could demote each other concurrently, leaving zero active superadmins | Non-atomic count-then-write; snapshot isolation permits write skew | `updateUser` runs in a transaction; removing a superadmin first writes a shared lock doc so concurrent attempts conflict and retry on fresh data | Concurrency tests (5 rounds + deactivate/demote). **Mutation check:** with the lock removed the tests fail (0 superadmins); with it they pass |
| 2 | Med | Changing your own password silently signed you out | `tokenVersion` bump invalidated own cookie | Route re-issues the cookie on self password change | Live: session still 200 after self change |
| 3 | Med | `?page=99` showed "No users yet" and "Page 99 of 3" | No clamping; empty state keyed off filters | Redirect to last page | Live: stream contains redirect to last page |
| 4 | Med | One invalid query param dropped all filters | Single `safeParse` of whole query | Per-field validation | Live: `role=bad&q=temp` keeps `q` |
| 5 | Med | Mobile drawer links stayed tabbable when closed; no Esc/focus handling; background interactive | Off-screen via transform only | `invisible` when closed, Esc closes, focus in/out, content `inert` while open | Code review (not browser-tested) |
| 6 | Med | Design-system breaches: hardcoded backdrop rgb, translucent overlay class, arbitrary width, `btn-sm` < 44px, sticky header inside scroll container | Ad-hoc values | `scrim` token (documented as the only translucent token), `w-11/12`, `btn-sm` min-h-11 on mobile, sticky removed | Code review; DESIGN_SYSTEM.md updated |
| 7 | Low | Modal: hardcoded id, drag-select release on backdrop closed it | — | `useId`; close only if press and release on backdrop | Code review |
| 8 | Low | Logout redirected even when the request failed | `finally` | Redirect only on success; error shown | Code review |
| 10 | Low | `resolveUser` threw on malformed uid; tests used hand-built sessions | Missing `isValidObjectId`; test shortcut | Returns null; new end-to-end sign→verify→resolve revocation test | Tests |
| — | Med | Stale cached `User` model under dev HMR dropped `tokenVersion` writes | Mongoose model cache outlives schema edits | Model deleted from cache outside production | Found in live test; fixed; verified on prod build |
| — | Med | Test files shared one DB in parallel and wiped each other | Vitest file parallelism | `fileParallelism: false` | Full suite stable |
| — | Med | Client bundle would import mongoose via `ROLES` | Roles exported from server model | `src/lib/roles.ts` shared module | `tsc`, import grep |

## Accepted / deferred

| Item | Decision |
|---|---|
| Forbidden pages return HTTP 200 (finding 9) | Accepted: pages are `noindex`, behind login, and every handler returns 403. Revisit when `forbidden()` is stable. |
| Unanchored case-insensitive regex search (finding 11) | Accepted for current scale; revisit at Stage 11 (text index / prefix search) if user counts grow. |
| Route-handler HTTP tests (401/403, same-origin, PATCH as admin) and UI form-logic tests | Verified by curl this stage; automated API + Playwright tests in Stage 12. |
| Mobile layout, modal behaviour and drawer focus not exercised in a browser; no axe scan | **Open.** Needs Playwright + axe (Stage 11/12). Owner can sanity-check on a phone width meanwhile. |
| Modal can be dismissed mid-submit | Accepted: the request still completes and the toast lives in the shell. |
| Stage 1 items still open: in-memory rate limiter, `next build` logs a prerender `cookies()` message from `/api/auth/me` | Unchanged (Stage 11 / cosmetic). |

## Tests performed

- `vitest`: **49 passing** (adds: service rules, regex-safe search, pagination, stats, tokenVersion bumps, revocation on demote/deactivate/password, DB-role-over-token-role, self-edit blocks, last-superadmin protection, concurrency ×2, malformed ids, validation, permission matrix).
- `tsc --noEmit`, `eslint`, `next build`: clean.
- Live HTTP on a production build: editor → 403 on users API; admin → 200 read / 403 create; mass-assign `tokenVersion` rejected; bad id 404; `limit=1000` 400; old sessions 401 after role change, deactivation and password reset; customer 403 on admin API; `Secure` cookie flag present in production (closes Stage 1 item); filters/pagination/empty-state behaviour.
- Test data created in the real database during checks was deleted afterward.

## Final audit status

Stage 2: **AUDIT_COMPLETE for functionality, security and server behaviour.** Browser/accessibility verification is explicitly carried forward (see above) rather than claimed.
