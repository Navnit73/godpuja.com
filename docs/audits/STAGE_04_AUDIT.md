# Stage 4 — Navigation: verification report

Status: **IMPLEMENTATION_COMPLETE — independent audit pending.** This report records the implementer's own verification; it is not the independent audit the workflow requires.

## Delivered
- `Menu` model, service, admin API (`/api/admin/menus[/:id]`), public `GET /api/menus/:key`.
- Admin editor `/admin/navigation` (list/create) and `/admin/navigation/:id` (nested tree: dnd-kit drag within a level, plus move up/down, nest, un-nest buttons as keyboard/touch alternative; ≤3 levels).
- Storefront header (`(store)` route group): desktop nav with accessible dropdowns, mobile menu, `mobile` menu override.
- Cache: `nav` / `menu:<key>` tags, 60 s revalidate; page publish/unpublish/rename/delete also invalidate `nav`.

## Decisions
- Link types limited to `page` and `external` until Stage 6 (catalog) to avoid dead links; the stored schema already allows the others.
- Page links store the page id and are resolved at read time (slug renames follow automatically; non-live or deleted pages and their subtree are hidden).
- `isDropdown`/`order` fields dropped: children imply a dropdown; array order is the order.
- Storefront routes moved into a `(store)` route group (no URL change) so admin/login do not get the site header.
- Saves use optimistic concurrency on `updatedAt` (409 on stale), same as pages.

## Verification
- `tsc --noEmit`, `eslint`, `next build`: clean.
- Vitest: 139 tests pass (new: `tests/menus.test.ts` — validation incl. depth/URL schemes/ids/limits, tree helpers, service CRUD, concurrency (two simultaneous saves → one wins), public resolution incl. drafts, disabled items, slug rename, scheduled pages, deleted pages, permissions).
- Live run against the test DB with `next start`: login → create/publish page → create menu → PUT tree → public API and server-rendered homepage show the new items with no rebuild; stale PUT → 409; unauthenticated PUT → 401; unpublishing the page empties the public menu immediately.

## Not verified / carried forward
- Browser pass of the editor (drag with pointer, screen-reader announcements) and axe scan of header + editor (Stage 11/12 with Playwright).
- Mobile menu is a simple disclosure panel (no focus trap) — acceptable for a non-modal panel; revisit in the a11y pass.
- `"use cache"` is per instance (see ARCHITECTURE A16).
