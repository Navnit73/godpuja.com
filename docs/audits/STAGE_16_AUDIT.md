# Stage 16 — Aarti & Mantras: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).
Scope source: [PRD v1.1](../PRD_v1.1.md) §9 (Aarti and Mantra module), §3.1 (URLs), §17 (Devanagari), §18 (SEO).

## Delivered

### Content
- One `Devotional` model for **aarti, mantras, chalisas and stotras**: deity, language of the text, lyrics (plain text, line breaks kept as written), optional English-letter text and meaning, short description, cover image, tags, reviewer and review date, SEO.
- Links to related aarti/mantras, Pooja Vidhi guides and shop products are **checked when saved**, so nothing goes live with a dead link. Renaming or changing the type keeps the old URL working (301) and updates other pages that listed it; deleting removes it from their related lists.
- **Reviewed before published**, as for Pooja Vidhi: text, a named reviewer and a review date are required to publish or schedule.
- Pooja Vidhi's "related aarti" (stored since Stage 15) now resolves: guides show **live** aarti under "Aarti and mantras for this pooja", and a missing slug is refused on save.

### Audio and rights (PRD §9: "remove content when rights expire or are withdrawn")
- Audio is a link to a file. It **cannot be saved without a rights record**: who made or owns it, how we may use it (original, licensed, public domain) and, for licensed audio, the agreement reference. Optional end date, and a **Withdrawn** switch.
- Whether audio plays is decided by one function, `audioStatus`, **every time a page is read** (not when saved): `ok`, `expiring` (within 30 days), `expired`, `withdrawn`, `unlicensed` or `none`. Only `ok` and `expiring` play. So audio disappears when the end date passes, or the moment someone ticks Withdrawn, within the 60-second storefront cache, with no edit or deploy. The lyrics stay.
- Records written outside the API with no rights (an import, an old row) do not play either. Previews follow the same rule. The public data carries the audio link and a credit line ("Recording: …") only, never the licence reference.
- The admin list shows an audio badge per item, and a notice counts recordings that are withdrawn, expired or expiring within 30 days.
- `AudioObject` structured data is emitted only while the audio may play.

### Public pages
- `/aarti` and `/mantras` (mantras, chalisas, stotras, with type chips): search, deity and language filters, cards with an "Audio" badge, pagination, and a "Coming soon" state. An item is served only under its own prefix. Filtered or searched lists are `noindex` and point their canonical at the plain list.
- Detail pages: description, **audio player**, lyrics in the right script (`lang="sa"`/`"hi"`/… so Devanagari uses its font), English letters, meaning, reviewer line, tags, related guides, aarti and products. `Article` + breadcrumb structured data. Sitemap lists both indexes (once something is live) and every live, indexable item. Unknown, draft and wrong-prefix URLs are real 404s.
- **Audio player**: play/pause, seek with a spoken time value, elapsed/total, volume, speed (0.75×–1.5×), all native controls so keyboard and screen readers work; the file is not downloaded until played; a failed load shows a message instead of a dead control.

### Admin
- Aarti & Mantras list (search, type, status, audio status, reviewed) and an editor with a live rights status message, publishing, scheduling (IST), preview link and delete. Content managers, admins and superadmins hold `devotional:*`.

## Bug found during the stage
- A field named `language` collided with MongoDB's text-index **language override**, so saving any item with `language: "hindi"` failed with "language override unsupported". The text index now sets `language_override` and `default_language: "none"`. Caught by the first test run; covered by every service test.

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint src tests` | clean |
| `vitest run tests/stage16.test.ts tests/stage15.test.ts` | 34 + 28 passing |
| Full `vitest run` | 545/545 passing on the final run (one earlier full run showed 2 failures that did not repeat; not identified, likely timeouts under load) |
| `next build` | compiles and lists the new routes, then stops with Next 16.4.3's "known security vulnerability" error, which **also happens on the untouched Stage 15 tree** (needs a Next.js upgrade; not caused by this stage) |
| Browser / axe / screen-reader pass | **not run** (see below) |

New tests (`tests/stage16.test.ts`, 34): every rights state, including the exact expiry instant, the 30-day warning and withdrawal beating expiry; validation (slugs, types, languages, unsafe audio URLs, audio needing rights, licence needing a reference, review name/date pairing, no self-links); the reserved prefixes and permissions; draft creation and unique slugs across types; stale saves and draft-only rights; dead links refused with their field; rename and type change (redirects, related lists); delete cleanup including Pooja Vidhi; publish rules, scheduling, preview by token and token reset; type-to-prefix separation; audio offered with credit, **hidden after expiry without any edit**, hidden when withdrawn or when the rights record is incomplete (including in previews); no licence reference in public data; the "needs attention" count; related items live-only and ordered; Pooja Vidhi integration; list filters, facets, search text never treated as a pattern; paging; the proxy's real 404s; the sitemap.

## Not verified / carried forward
- **No browser, axe or screen-reader run for the new pages, the player or the editor.** The player was not played against a real file here.
- **Audio is a pasted URL.** There is no audio upload to Cloudinary (the media service accepts images only) and the link is not checked to be reachable or really audio. Owner to supply hosting, or a follow-up adds audio upload.
- **No recordings or licences exist yet** (owner decision 13, content/legal). Until then the module runs lyrics-only, as the PRD allows.
- The storefront cache means audio can stay visible for up to about 60 seconds after rights end on a single server (longer only if the cache is not refreshed; admin edits and withdrawals refresh it at once).
- Rights are a record, not a legal check: nobody verifies a licence reference. Expiry warnings appear only in the admin; there is no email reminder.
- Favourites and sharing (PRD §9, "if schedule permits") are not built. Homepage highlights for aarti/mantras and the pillar tile come with Stage 17.
- Search is a simple match on title, deity, tags and description (no ranking, no Devanagari-aware matching), fine at this catalogue size.
