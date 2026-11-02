# API Documentation

Base path `/api`. JSON only. Auth via httpOnly session cookie. Mutations require same-origin `Origin`.

**Success:** `{ "data": …, "meta": { "page", "limit", "total" }? }`
**Error:** `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "Invalid" }? } }`
Codes → HTTP: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `INTERNAL` 500.
Lists: `?page=1&limit=20` (max 50), `?q=` plus module-specific filters. Request bodies must be `application/json` and ≤ 1 MB. Unknown `/api/*` paths return the JSON `NOT_FOUND` envelope. Only needed fields are projected.

Permission column: `—` public, `auth` any logged-in user, otherwise a permission string.

## Auth (Stage 1)
| Method | Path | Perm | Notes |
|---|---|---|---|
| POST | /auth/login | — | rate-limited (5/min per IP+email, 30/min per IP, 20 failed attempts/15 min per account); sets cookie; returns `role` |
| POST | /auth/logout | — | clears the cookie (idempotent). Sessions are stateless: a copied cookie stays valid until it expires (7 days) or the user's role/active/password changes (`tokenVersion`) |
| POST | /auth/register | — | customer role only. **Closed by default** (403) unless `ALLOW_PUBLIC_REGISTRATION=true`; enabled with the storefront account pages (Stage 8/9) |
| GET | /auth/me | auth | current user |

## Users & roles (Stage 2)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /admin/users | users:read | `q`, `role`, `page`, `limit` (≤50); `meta {total,page,limit,pages}` |
| POST | /admin/users | users:write | `{name,email,password,role}` |
| GET | /admin/users/:id | users:read | |
| PATCH | /admin/users/:id | users:write | any of `name, role, isActive, password`; unknown keys ignored |

No DELETE: users are deactivated (`isActive:false`) so order history stays intact. Rules (server-enforced, transactional): no self role change/deactivation; last active superadmin cannot be demoted/deactivated; role/active/password changes revoke the user's sessions (`tokenVersion`); changing your own password re-issues your cookie.

## Pages (Stage 3)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /admin/pages | pages:read | `q`, `status`, `page`, `limit` (≤50) |
| POST | /admin/pages | pages:write | always created as `draft` |
| GET | /admin/pages/:id | pages:read | |
| PATCH | /admin/pages/:id | pages:write | content only (`title, slug, description, sections, seo`) **plus required `baseUpdatedAt`** (the `updatedAt` you loaded; stale => 409). Status/token cannot be set here. Changing a non-draft page also needs `pages:publish` |
| DELETE | /admin/pages/:id | pages:write | hard delete |
| POST | /admin/pages/:id/publish | pages:publish | body `{action:"publish"}` \| `{action:"unpublish"}` \| `{action:"schedule", publishAt:<future ISO>}` |
| POST | /admin/pages/:id/preview-token | pages:write | rotates the secret preview token (old link stops working); returns the full page (new `updatedAt`) |

Public rendering is not an API: `/[...slug]` (live pages only; scheduled pages go live once `publishAt` passes, within ~60 s) and `/preview/:token` (any status, `noindex`, `no-referrer`, never cached). Section types: `richtext {markdown}`, `imageText {heading, markdown, imageUrl, imageAlt, imagePosition, ctaLabel, ctaUrl}`. Markdown is sanitized (allowlist) at render time. Slugs: 1–3 lowercase kebab segments; first segment may not be reserved (`admin`, `api`, `login`, `cart`, …).

## Navigation (Stage 4)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /menus/:key | — (cached ≤60 s, tag `nav`) | Resolved tree: disabled items, links to non-live/deleted pages (and their subtrees) removed; page refs resolved to current URLs. 404 if the menu does not exist |
| GET | /admin/menus | nav:write | list (`id, key, name, itemCount, updatedAt`) |
| POST | /admin/menus | nav:write | `{key, name}`; duplicate key => 409 |
| GET | /admin/menus/:id | nav:write | |
| PUT | /admin/menus/:id | nav:write | whole tree `{name, items, baseUpdatedAt}`; stale `baseUpdatedAt` => 409; linked pages must exist; ≤3 levels, ≤100 items; link types `page` and `external` only until Stage 6 |

Storefront: the header uses menu `header` (items filtered by `showOnDesktop`); on small screens the `mobile` menu if it has items, else `header` filtered by `showOnMobile`. Admin saves and any page publish/unpublish/slug change call `revalidateTag("nav")`.

## Footer (Stage 5)
| Method | Path | Perm |
|---|---|---|
| GET | /footer | — (cached) |
| PUT | /admin/footer | footer:write |

## Catalog (Stage 6)
| Method | Path | Perm |
|---|---|---|
| GET | /products | — (`category, q, sort, minPrice, maxPrice, featured, page, limit`) |
| GET | /products/:slug | — |
| GET | /products/:slug/related | — |
| GET/POST | /admin/products | products:read/write |
| GET/PATCH/DELETE | /admin/products/:id | products:write |
| PATCH | /admin/inventory/:id | inventory:write (atomic `$inc` / set) |
| GET | /categories | — (tree, cached) |
| GET/POST | /admin/categories · PATCH/DELETE `/admin/categories/:id` | categories:write |
| POST | /admin/media (multipart) · GET /admin/media · DELETE /admin/media/:id | media:write |

## Homepage (Stage 7)
GET `/homepage` (— cached, resolves product rails in one batched query); PUT `/admin/homepage` — `home:write`.

## Cart, checkout, orders (Stage 9)
| Method | Path | Perm | Notes |
|---|---|---|---|
| POST | /cart/validate | — | recompute prices/stock server-side |
| POST | /checkout | — | requires `Idempotency-Key`; transaction: validate → decrement stock → create order → create payment intent |
| POST | /payments/webhook | signature | idempotent on provider event id |
| GET | /orders/:id | owner or token | confirmation view |
| GET | /account/orders | auth | |
| GET | /admin/orders | orders:read | filters: status, payment, date, q |
| GET | /admin/orders/:id | orders:read | |
| PATCH | /admin/orders/:id/status | orders:write | validated transition |
| POST | /admin/orders/:id/notes | orders:write | |
| POST | /admin/orders/:id/refund | orders:refund | |
| GET | /admin/orders/export | orders:read | CSV, streamed |

## SEO & settings (Stages 5/10)
GET `/sitemap.xml`, `/robots.txt` (Next metadata routes); GET/POST `/admin/redirects`; GET/PUT `/admin/settings` — `settings:write`; GET `/admin/dashboard` — `dashboard:read`; GET `/admin/customers` — `customers:read`.

## Rate limits (initial)
login 5/min/IP+email · register 5/min/IP · checkout 10/min/IP · search 60/min/IP · admin writes 120/min/user.
