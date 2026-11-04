# Stage 14, slice 3 — reviews, ratings, filters, wishlist, recently viewed: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending** (implementer's own verification only). This completes Stage 14.
Scope source: [PRD v1.1](../PRD_v1.1.md) §5.2 (rating, wishlist, filters by deity/material/size/availability/rating/occasion, sort by rating), §5.3 (reviews, recently viewed), §11 (wishlist), §18 (no rating schema without visible, verified data).

## Delivered

### Reviews and ratings
- **Verified purchase only**: a customer can review a product only if one of their own orders containing it is *delivered*. One review per product. Guests, other people's orders, shipped-but-not-delivered orders and other products do not qualify.
- **Moderated**: a new review, and any edit, is `pending` until staff publish it. Only published reviews are shown, counted in the product's rating, or used in structured data. Editing a published review takes its stars out until it is approved again. Customers can edit and delete their own review and see its status ("waiting for review by our team").
- **Admin Reviews** page (store managers, admins): queue by status (pending, published, rejected), oldest first, with Publish, Reject or Unpublish and Delete. Moderation is audit-logged.
- **Ratings appear only with reviews behind them**: stars and count on product cards, the product page (with a breakdown bar per star level and "Verified purchase" on every review), related products, and a `schema.org` `aggregateRating` only when published reviews exist. A "Top rated" sort and a "4 / 3 stars & up" filter use published reviews only.
- **Exact under concurrency**: rating totals change only through atomic pipeline updates in the same transaction as the moderation write. Tested with 8 simultaneous approvals and 8 simultaneous withdrawals: the totals are exact and return to zero.

### Filters (§5.2)
- Deity, material, occasion and size (from product attributes of that name, any letter case), in stock only, and minimum rating, on `/shop`, every category page and search. The panel lists **only values that exist** among the products being browsed, with counts, merges "Ganesha"/"ganesha", and leaves out a group with no values (no empty "Size"). Values are matched as plain text, never as a pattern.
- Plain links: work without JavaScript, every state is a shareable URL, the chosen option is marked current and pressing it again turns it off, with a "Clear all filters" link and an explained empty state.
- Every filtered or re-sorted page is `noindex, follow` with the plain listing as its canonical, so filters cannot create duplicate pages in search.

### Wishlist and recently viewed
- A heart on every product card and product page. Signed-out visitors are sent to sign in and come back to the same page. Saving is instant and confirmed by the server, safe to repeat, limited to products a visitor could open, and capped at 200. `/account/wishlist` lists what is saved and still public.
- "Recently viewed": remembered in the visitor's own browser only (nothing is sent anywhere until the cards are loaded), shown under related products, and hidden or deleted products are dropped.

## Bugs found and fixed during the stage
- **Rounding disagreed between code and database**: MongoDB's `$round` rounds halves to even (3.625 → 3.62) while the page's JavaScript rounded up (3.63), so the stored rating and the one on screen could differ by 0.01. Both now use one formula (round half up), with a test.
- **Heart race**: pressing a heart while the first "what is saved?" request was still in flight let that older answer overwrite the click. A click now waits for the first load.
- Facet display value was picked arbitrarily when two spellings merged; it is now stable ("Ganesha").

## Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint src tests scripts` | clean |
| `vitest run` | see result below the table |
| `next build` | passes |
| Browser (Chrome headless, built app, **test** database; shopper at 390 px, admin at 1280 px) | **48/48 checks**: filter panel with counts and no empty group; filter narrows, marks the choice, is `noindex` with the plain canonical; In stock hides the sold-out product; empty result explained; signed-out heart goes to sign in and back; heart saves, survives a reload, appears on the wishlist page and removes cleanly; non-buyer is told why they cannot review; buyer's form validates and submits; the review is pending and **nothing is public or in structured data**; admin sees and publishes it; rating, "Verified purchase", "Asha R." and the aggregate rating then appear; Top rated puts it first and a card shows stars; the 4-star filter shows only it; unpublishing removes it again; recently viewed shows the previous product; every page fits 390 px with no console errors; axe (WCAG 2.1 A/AA) clean on all of them |

New tests (`tests/stage14c.test.ts`, 30): rating maths and display names; review validation; structured data only with a rating; URL parsing of every filter (bad values ignored, links keep and reset correctly, any filter makes a page noindex); permissions; facets (only existing values, case merged, scoped to the category, drafts and hidden categories ignored, regex characters treated as text); filtering by facet, stock (with and without variants) and rating (published only), sort by rating; review rules (every way of not qualifying, pending until published, publish/unpublish/delete move the rating exactly, edit takes stars out, duplicates and double submits, 8 simultaneous approvals and withdrawals, public list newest first with breakdown and no ids, queue oldest first, product leaving the shop); wishlist (idempotent, per customer, parallel adds, only visible products, gone products drop out, the 200 cap); cards by slug (order kept, unknown dropped); the public cards route.

## Not verified / carried forward
- **Facets come from the free-text product attributes** an admin types ("Deity", "Material", "Occasion", "Size"). Consistent spelling in the catalogue gives better filters (different spellings are merged by letter case only). Variant options such as a size chosen at purchase are not used as the Size filter.
- Review photos, "was this helpful" votes, replies from the shop, and review emails are not built.
- Reviews show the 10 most recent; there is no "show more" yet.
- Recently viewed and the hearts load after the page (they depend on the visitor), so they appear a moment later.
- A request cancelled by the browser (for example reloading mid-save) logs `[api] unhandled error: aborted` on the server. Harmless, but noisy; worth quieting before launch.
