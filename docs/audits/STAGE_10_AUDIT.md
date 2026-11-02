# Stage 10 — SEO: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only).

## Delivered
- **Real HTTP statuses** decided in `proxy.ts` before the page streams (after that the status is fixed at 200): malformed URL → 400, recorded redirect → 301 (query kept), unknown product / category / CMS page → 404 via `/page-not-found`. Lookups (`src/server/route-check.ts`) are cached per instance and fail open if the DB is unreachable.
- **Redirects**: automatic for product, category (whole subtree) and now **CMS page** slug changes; manual redirects on `/admin/seo` (normalised, chains collapsed, loops refused, internal paths protected); cleared when a URL becomes a real page again, dropped when the target is deleted.
- **Metadata**: site defaults from `/admin/seo` (title template `%s — Site`, default description, share image, Twitter handle); per-page title/description/canonical/OG/Twitter for home, CMS pages, categories, products; sorted/filtered listings `noindex, follow` + canonical to the plain listing; paginated listings self-canonical with "page N" titles; private pages `noindex`.
- **JSON-LD** (escaped so stored text cannot close the script): Product with Offer/AggregateOffer (INR, availability), BreadcrumbList (product, category), Organization + WebSite with SearchAction (home; social profiles from the footer as `sameAs`).
- **sitemap.xml** (indexable URLs only, cached, refreshed by catalog/page changes) and **robots.txt**.
- Admin `/admin/seo` (seo:write): settings form with length counters + redirects manager (add, search, paginate, delete).

## Verification
- `tsc`, `eslint`, `next build` clean; `tests/seo.test.ts` (11): redirect validation and normalisation, settings validation/concurrency, JSON-LD escaping and offers, chain collapse / loop refusal / re-pointing, CMS slug 301 lifecycle, route decisions for every path type, cache windows, sitemap contents (drafts, noindex, hidden categories and their products excluded), permissions. Full suite: **13 files, 283 tests pass**.
- Live run (test DB, `next start`): `/product/nope`, `/category/nope`, `/no-such-page`, `/product/BAD` → **404**; malformed `%E0%A4%ZZ` → **400**; renamed product → **301** to the new slug (query preserved), new slug 200; titles unique per page (`Diwali Kit — GodPuja`, `Puja Kits — page 2 — GodPuja`, homepage title as-is); canonicals absolute; sorted category listing `noindex, follow` with base canonical; cart `noindex`; product JSON-LD valid JSON with `</script>` in a description escaped (`<`); robots.txt and sitemap.xml (home, category, product only) correct; admin SEO page 200; API 401 unauthenticated.

## Known limitations / carried forward
- The 404 response body is Next's error shell (`__next_error__`) with the not-found page delivered in the RSC payload: browsers with JavaScript see the full not-found page (header, footer, "Page not found — GodPuja"); clients without JavaScript see a blank page. Status and `noindex` are correct for crawlers. Revisit if Next adds a way to fully server-render a pre-stream 404.
- Proxy caches are per instance: a new redirect, or a just-created/just-hidden product, can take up to 60 s (15 s for a previously unknown URL) to be reflected in the status code; the page itself is always correct (with noindex on not-found).
- Google Rich Results / Schema validator not run — needs a publicly reachable URL (do at Stage 12 on staging).
- `SITE_URL` must be the production origin in production builds (canonicals, sitemap, JSON-LD use it).
- Product `schemaOverrides` from the original schema plan were not added (no admin need yet).
