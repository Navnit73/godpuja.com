# Phase 1 production checklist

Work through this before pointing the real domain at the app. Items marked **Owner** need a decision or an account only the owner has; the rest are one-off steps.

## Blockers (do not launch without these)
- [ ] **Upgrade Next.js.** 16.4.3 is flagged as having a known security vulnerability; `next build` refuses to finish and `next dev` prints an upgrade notice. Upgrade, rerun `npm run build`, `npm test`, `npm run e2e:phase1` and the browser audits.
- [ ] **Owner: publish the legal pages.** Run `npm run seed:legal -- --apply`, have the **Cookie policy** and **Data retention** drafts reviewed (retention periods and contact address are starting values, not legal advice), then publish them. Update the **Privacy policy** with the analytics paragraph the script prints (the demo text says there are no trackers). Link all three in the footer.
- [ ] **Owner: payment gateway** decision (only cash on delivery works today).
- [ ] **Owner: rotate the Atlas password, change the seeded admin password**, set a real `AUTH_SECRET` (≥ 32 characters).

## Environment
- [ ] `SITE_URL` is the real https URL **at build time** (HSTS and `upgrade-insecure-requests` are gated on it).
- [ ] `MONGODB_URI` points at the production database; run `migrate:stage12`, `migrate:stage14` (dry run first), `migrate:stage15` (dry run first) once.
- [ ] Cloudinary and Resend credentials set; send a test order email; upload a test image.
- [ ] Google sign-in client ID/secret set, redirect URI registered (if used).
- [ ] Hosting is a single instance (ARCHITECTURE A16) or the shared-cache caveats are accepted.

## Analytics and search
- [ ] `/admin/seo`: set the GA4 measurement ID and the Search Console verification code. Confirm in a private window that **nothing** is sent to Google until "Accept analytics", and that "Reject" keeps it that way.
- [ ] Verify the property in Search Console and submit `/sitemap.xml`.
- [ ] Check `/robots.txt` allows the site and lists the sitemap.

## Content
- [ ] Homepage: add the **Quick-access tiles**, **Pooja Vidhi** and **Aarti & Mantras** highlight sections in `/admin/homepage`.
- [ ] At least a few reviewed Pooja Vidhi guides and aarti are published.
- [ ] **Owner (decision 13): audio.** Publish audio only with a complete rights record. With none, the module runs lyrics-only. Audio must be hosted on https and must allow direct playback.
- [ ] Footer includes Privacy, Cookie policy, Data retention, Terms, Shipping, Returns. Coming-soon tiles (Temples, Book a Pooja, Donate) stay marked until their stages ship; then flip `live` in `src/lib/pillars.ts` and remove the placeholder page.

## Verification to run on the production build
- [ ] `npm test` (560 tests) and `npm run e2e:seed` + `npm run e2e:phase1` against a server on the **test** database.
- [ ] `npm run audit:a11y` / `audit:browser`; a manual screen-reader pass of checkout, the audio player and the cookie banner.
- [ ] **Lighthouse (PRD §19.3)** on home, a category, a product, a Pooja Vidhi guide and an aarti page, mobile profile, from the production host: Performance ≥ 85 and the other targets in §19.3. Record the results in the Stage 17 audit.
- [ ] `npm run bench` from a host in the same region as Atlas (p95 < 150 ms target).
- [ ] Back up the database and test a restore.
