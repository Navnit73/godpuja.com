# Stage 3 Audit — CMS Pages & Dynamic Rendering

Date: 2026-11-02 · Auditors: implementer (tests + live checks on a production build) and an **independent reviewer agent** (code/docs read only).

## Issues identified and fixed

| # | Sev | Issue | Root cause | Fix | Verified by |
|---|---|---|---|---|---|
| 1 | Med | Preview token could leak via `Referer` (images in page, streamed metadata) and preview `noindex` was metadata-only | No response headers; `<img>` had no referrer policy | `next.config.ts` headers for `/preview/*` (`Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`); `referrerpolicy="no-referrer"` on all rendered images (sanitizer + component) | Live: headers present, attribute in HTML; sanitizer test |
| 3 | Med | Two editors saving the same page silently overwrote each other | No version check | Optimistic concurrency: PATCH requires `baseUpdatedAt`; stale => 409; editor locks form while saving; rotating the preview token returns the new version | Tests (stale, simultaneous, rotate); live 409 + 400 on missing field |
| 4 | Med | Scheduling a live page silently took it offline | `schedule` sets status `scheduled` | Editor hides Schedule for live pages ("unpublish first") | Live HTML check |
| 5 | Low | A write-only user could edit/delete live content | Only `pages:write` checked | Non-draft changes require `pages:publish` (moot with today's roles, enforced for future ones) | Code review |
| 6 | Low | Malformed `%` sequences could throw in our decoder | Unguarded `decodeURIComponent` | try/catch → not-found | Code (see accepted item) |
| 7 | Low | Junk slugs filled the cache for an hour | Same lifetime for hits and misses | Misses cached 15 s/expire 60 s | Code review |
| 8 | Low | Hindi titles produce an empty auto-slug | `slugify` is ASCII-only | Hint: use an English slug | UI text |
| 9 | Low | Duplicate section ids accepted via API | No uniqueness rule | Schema refine | Test |
| 10 | Low | Scheduled pages never got `publishedAt` | — | `publishedAt = publishAt` on schedule | Test |
| 11 | Low | A11y: error not linked to markdown field; no unsaved-changes guard | — | `aria-describedby` incl. error; `beforeunload` guard when dirty | Code review |
| 12 | Low | Wide tables scrolled the whole page; first-child top margin; empty image column | CSS/layout | `.content` table scroll, first-child margin 0, single column without image | Code review |
| — | Med | Preview route did request-time DB work in a prerenderable scope, logging "unstable value `new Date()`" errors | Missing request-time marker | `await connection()` in preview metadata and content | Runtime log: 0 errors |
| — | Med | Sanitizer attack coverage | — | Added entity-, tab-, space- and backslash-obfuscated URL cases | Tests |

## Accepted / deferred

| Item | Decision |
|---|---|
| Unknown/draft/unpublished URLs return HTTP 200 with not-found UI + `noindex` (soft 404) | **Known limitation.** `x-nextjs-postponed` shell streams first. `generateStaticParams` was tried and did not help. Proper fix: existence check in `proxy.ts` alongside redirect lookup — **Stage 10**. |
| Changing a page slug does not 301 the old URL | Stage 10 (redirects table). |
| Malformed percent-encoding (`/%E0%A4%A`) returns 500 on **every** route, including static ones | Framework-level behaviour, not CMS code. Add a 400 guard in proxy with the Stage 10 proxy work / Stage 11 hardening. |
| `"use cache"` invalidation is per instance (finding 2) | **Deployment constraint** documented as A16 in ARCHITECTURE.md. Single instance, or shared cache handler, to be decided at Stage 11. |
| Remove-section has no confirm; focus not restored after move/remove | Low; revisit with the Stage 11/12 a11y pass. |
| Route-handler HTTP tests (publish perm enforcement, PATCH mass-assignment end-to-end, cache invalidation) | Schema-level mass-assignment test added; handler/cache behaviour verified by curl. Automated API tests in Stage 12. |
| Editor UI not exercised in a browser; no axe scan | Open (same as Stage 2). Playwright + axe planned. |

## Tests performed

- `vitest`: **109 passing** (adds: sanitizer vectors incl. obfuscation, slug rules/reserved names, URL/alt/CTA validation, schedule validation, duplicate ids, mass-assignment stripping, draft/publish/unpublish/schedule visibility incl. clock movement, disabled sections, preview token lifecycle, optimistic concurrency incl. simultaneous saves, unique slug race, list/search regex safety, delete/NOT_FOUND paths).
- `tsc --noEmit`, `eslint`, `next build`: clean.
- Live on a production build: draft/unpublished/future-scheduled/revoked-preview/old-slug URLs show the not-found UI with no content leakage; publish → visible, edit → instantly updated (cache invalidation), slug change/unpublish → old URL gone; script/`javascript:`/`onerror` payload never reaches HTML; customer 403 on all pages endpoints, unauthenticated 401, cross-origin 403; preview headers; 409 on stale save. Test data deleted afterward.

## Final audit status

Stage 3: **AUDIT_COMPLETE** for server behaviour, security and rendering. Browser/accessibility verification and the soft-404 are explicitly carried forward, not claimed.
