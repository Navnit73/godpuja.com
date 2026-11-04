# Stage 15 — Pooja Vidhi: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).
Scope source: [PRD v1.1](../PRD_v1.1.md) §8 (Pooja Vidhi content module), §3.1 (URLs), §17 (Devanagari), §18 (SEO, Article), plus the commerce integration note in §8.

## Delivered

### Structured guides
- A guide has a **category** (daily, festival, special, vrat/katha, step-by-step), deity and time needed, an **introduction**, **significance**, a **samagri list**, **preparation**, numbered **steps** (each with an optional mantra), **mantras with meanings**, extra text, related products, guides and aarti, tags, a cover image, author, **reviewer and review date**, and SEO fields.
- **Samagri items link to shop products**: an item shows "Buy <product> · price" beside it when the product is in stock, and quietly loses the link if the product sells out or leaves the shop. Related products appear after the content as "Essentials for this pooja", so links help the reader without interrupting the guide (PRD §8).
- **Links are checked when you save**: a product or guide that does not exist is refused with the exact row highlighted, so a guide never goes live with a dead link.
- **Reviewed before published**: publishing or scheduling needs an introduction, at least one step (or body text), a **named reviewer and a review date**. The editor lists what is missing and keeps Publish disabled until it is ready. This is the PRD's accuracy review, made a gate (easy to relax if too strict).

### Workflow (same as CMS pages)
- Draft, schedule (IST) and publish, unpublish, **secret-link preview** that shows drafts (noindex, never cached, resettable without causing a false edit conflict), and **compare-and-set saves** so two editors cannot silently overwrite each other. Without publish rights an editor can only change drafts. Renaming the URL keeps the old link working (301) and updates other guides that listed it; deleting removes it from their related lists.
- Admin **Pooja Vidhi** list (search, status, category, reviewed badge) and an editor with repeatable rows for samagri, steps and mantras (move up/down, remove), for content managers, admins and superadmins.

### Public pages
- `/pooja-vidhi`: category chips with counts, cards, pagination, a "coming soon" state when empty. `/pooja-vidhi/<slug>`: reading order of introduction, reviewer line ("Reviewed for accuracy by … on …"), significance, samagri, preparation, numbered steps, mantras, tags, related products and guides.
- **Devanagari** is marked `lang="sa"` and set in Noto Sans Devanagari, loaded only on pages that contain such text. All Markdown is sanitised (script tags and `javascript:` links are stripped).
- SEO: unique title and description, canonical, Open Graph `article`, **`Article` structured data with author and modified date** plus breadcrumbs, and the sitemap lists the index and every live, indexable guide. Drafts, scheduled and unpublished guides are real 404s (after the proxy cache window, below).
- `npm run migrate:stage15` copies the old Guides into Pooja Vidhi **as drafts** (dry run by default, originals untouched). The dev database has none to copy.

## Bug found during the stage
- A test imported the migration script, which loads `.env.local` with override and so **pointed the test at the real `godpuja` database**. The test suite's safety check refused to run (nothing was written). Pure logic now lives in `src` and tests never import scripts.

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint src tests scripts` | clean |
| `vitest run` | see result below the table |
| `next build` | passes |
| Browser (Chrome headless, built app, **test** database; admin at 1280 px, visitor at 390 px) | **44/44 checks**: empty list explained; slug follows the title; an unknown product slug is flagged on its row; guide created as a draft; the editor lists the missing reviewer and date and keeps Publish disabled; a signed-out visitor sees the draft through the preview link (noindex) while the public URL is a real 404; checklist clears after review; publish; index lists it with a category count; the article shows every section, the reviewer line, the Buy link to the product, related products, tags, numbered steps, Devanagari marked `lang="sa"` in the Devanagari font stack, `Article` + breadcrumb structured data, canonical and title; the sitemap lists it; renaming redirects the old URL; unpublishing removes it; the empty index says "coming soon"; no console errors; every page fits 390 px; axe (WCAG 2.1 A/AA) clean on the list, the editor (draft, with an error, and live), the index and the article |

New tests (`tests/stage15.test.ts`, 28): validation of every field (limits, slugs, categories, review name and date together, cover alt, no self-links, `javascript:` image URLs); the publish rules; excerpts; migration conversion; the reserved URL prefix; permissions; draft creation and unique slugs; every kind of dead link refused with its field; compare-and-set saves; rename (redirect and other guides updated, slug conflicts); draft-only rights; delete cleans related lists; list filters (and that search text is not a pattern); publishing refused until reviewed, original date kept, unpublish, schedule goes live only at its time, simultaneous publish clicks stay consistent; preview by token only, reset revokes and does not change the version, malformed tokens; sanitised rendering and structured sections; Buy links that appear, disappear and survive a deleted product; related products in order and only live related guides; the public list (newest first, counts, filter, pages); the proxy's real 404s; the sitemap.

## Not verified / carried forward
- **The proxy's in-memory cache** (new guide "not found" for up to 15 s, removed or renamed URLs for up to 60 s on one server) is shared with pages and products; it is the reason a just-published guide can briefly 404 on a single instance. Multi-instance hosting would add the same effect per instance.
- **No Markdown preview inside the editor** (use the Preview link after saving). No drag-and-drop for reordering rows (up/down buttons).
- **Aarti links** are stored but not shown until Stage 16 can resolve them. **Related guides by tag** are manual.
- **Hindi guides**: the page and fonts support Devanagari text, but there is no language switch or translated field set yet (Phase 3 localisation).
- Reviewer and review date are free text and a date: there is no separate reviewer account or sign-off history.
- The old "Guides" section keeps working next to Pooja Vidhi. Retiring it (and redirecting `/guides` and its posts) is an owner decision after content is migrated.
