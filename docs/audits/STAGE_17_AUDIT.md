# Stage 17 — Phase 1 release: verification report

Status: **IMPLEMENTATION_COMPLETE (code) — release NOT signed off.** Independent audits of stages 8–17, Lighthouse numbers and the Next.js security upgrade are still open (see below).
Scope source: [PRD v1.1](../PRD_v1.1.md) §3 (pillars), §4 (homepage), §18 (analytics, SEO), §19.2 (privacy), §19.3 (performance), plus [PRODUCTION_CHECKLIST](../PRODUCTION_CHECKLIST.md).

## Delivered
- **Homepage sections** (added to the admin homepage editor): *Quick-access tiles* (Shop, Find Temples, Book a Pooja, Pooja Vidhi, Aarti & Mantras, Donate; tiles for pillars that have not shipped are labelled "Coming soon"), *Pooja Vidhi highlights* and *Aarti & Mantras highlights* (aarti, mantras or both; newest live items; "Audio" badge only while rights are valid; a highlight with nothing live is hidden rather than shown empty). The homepage cache refreshes when guides or items are published.
- **Coming-soon pages** `/temples`, `/book-a-pooja`, `/donate`: real 200 pages with links to what is ready, `noindex`, left out of the sitemap, and their URLs are reserved so no CMS page can claim them. Flip `live` in `src/lib/pillars.ts` when a pillar ships.
- **Analytics**: GA4 ID and Search Console code in `/admin/seo` (validated: a pasted tag or script is rejected). GA4 loads **only after the visitor accepts**; the banner offers Reject as prominently as Accept, remembers the choice, and the footer's **Cookie settings** reopens it (rejecting removes `_ga` cookies). With no ID configured nothing renders. The CSP now allows only Google Tag Manager / Analytics hosts.
- **Legal**: `npm run seed:legal` creates *Cookie policy* and *Data retention* pages as **drafts** describing what the app actually does (sign-in cookie, local-storage cart, consent-gated GA4); it prints the analytics paragraph the existing Privacy policy needs. Never overwrites a page. **The text is a starting point, not legal advice.**
- **Phase 1 end-to-end run**: `npm run e2e:seed` + `npm run e2e:phase1` (real Chrome, test database).
- **Production checklist**: [docs/PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md).

## Bugs found during the stage
- **CSP blocked audio from any other host** (`media-src 'self'`): a recording hosted on a CDN, as Stage 16 assumes, would never have played. Now `media-src 'self' https:`; rights are still enforced in the app.
- **No way to change cookie consent when no footer is configured**: the fallback footer had no "Cookie settings" link. Found by the E2E; fixed.

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit`, `eslint src tests scripts` | clean |
| `vitest run` | 560/560 (15 new in `tests/stage17.test.ts`) |
| Phase 1 E2E in Chrome (390 px, `next dev`, test database) | **45/45**: banner on first visit; no Google request before a choice, after Reject, or after reload; "Cookie settings" reopens it; `gtag` requested only after Accept with the configured ID; six tiles, three "Coming soon"; highlights; coming-soon pages 200 + noindex; aarti index, Audio badge only where rights are valid, search narrows and is noindex; player with play/seek/volume/speed, credit line, `lang="hi"` lyrics, Article + AudioObject data; withdrawn recording shows no player, no AudioObject, lyrics stay; mantra under `/aarti` and unknown slugs are real 404s; guide shows its related aarti; sitemap lists the new pages and omits coming-soon; no uncaught errors; axe (WCAG 2.1 A/AA) clean on 6 pages; no horizontal overflow at 390 px |
| `next build` | **fails on the untouched tree too**: Next 16.4.3 stops with a "known security vulnerability" error. The E2E therefore ran on `next dev` |

## Not verified / carried forward (release blockers marked **)
- ** **Next.js upgrade** (security) and a clean production build, then a re-run of everything above on the built app.
- ** **Independent audits** of stages 8–17 are not done; every stage is "self-verified".
- ** **Lighthouse (PRD §19.3)** was not run; nothing is recorded. `bench` p95 from a same-region host also still open.
- ** **Legal text** needs the owner's / a lawyer's review before publishing; retention periods are placeholders. The GDPR/Canadian-law compliance in PRD §19.2 is not assessed by this stage (no data-export or self-service deletion feature: deletion is by email).
- The real GA4 and Search Console were not exercised (no IDs): the E2E only proves the script is requested after consent, with the right ID, and blocks it before.
- The audio player was driven (controls, speed) but never played a real file; autoplay and streaming behaviour on real devices is untested. No screen-reader pass.
- Playwright **test runner** is not used: the E2E is a script on `playwright-core` like the existing audits, with no CI wiring.
- Admin flows for Stages 15–17 (editors) were not part of this E2E.
