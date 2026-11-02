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

## Footer & newsletter (Stage 5)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /footer | — (cached ≤60 s, tag `footer`) | Resolved footer (`data: null` until first saved): disabled items, dead page links and empty columns removed; `{year}` filled in |
| GET | /admin/footer | footer:write | returns defaults with `updatedAt: null` before the first save |
| PUT | /admin/footer | footer:write | whole document + `baseUpdatedAt` (`null` only for the first save; stale => 409); linked pages must exist |
| POST | /newsletter | — | `{email, website?}`; rate limited (5/min/IP); idempotent (always `{subscribed:true}` for valid input, so addresses cannot be enumerated); non-empty honeypot field `website` stores nothing |

Page publish/unpublish/rename/delete also revalidate the `footer` tag.

## Catalog & media (Stage 6)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /categories | — (tree, cached, tag `categories`) | active only; an inactive category hides its subtree **and its products** (list, search, detail, homepage rails) |
| GET | /products | — (rate limited 120/min/IP, uncached, index-backed) | `category` (path, includes active descendants), `q` (text search), `sort` (`newest`\|`price-asc`\|`price-desc`\|`popular`), `minPrice`/`maxPrice` (paise, on sale-or-list price), `featured=1`, `page`, `limit` (≤50). Never exposes stock counts (`inStock` only) |
| GET | /products/:slug | — (cached, tag `product:<slug>`) | active products only; description sanitised; variants with `inStock` |
| GET/POST | /admin/categories | categories:write | list is flat in tree order with product counts |
| GET/PATCH/DELETE | /admin/categories/:id | categories:write | PATCH = whole record + `baseUpdatedAt` (409 if stale); slug/parent change moves the subtree + records 301s atomically; DELETE refused (409) with children/products |
| GET/POST | /admin/products | products:read / write | list: `q` (name/SKU/variant SKU), `status`, `category`, `lowStock=1`, `page`, `limit` |
| GET/PATCH/DELETE | /admin/products/:id | products:read / write | PATCH needs `baseUpdatedAt`; **ignores stock** for existing products |
| PATCH | /admin/inventory/:id | inventory:write | `{delta}` or `{set}`, plus `sku` for variants; atomic; 409 if it would go below zero |
| GET/POST | /admin/media | media:write (GET also products:write) | POST multipart `file`; JPEG/PNG/GIF/WebP by magic bytes, ≤5 MB; 503 `NOT_CONFIGURED` without Cloudinary credentials |
| PATCH/DELETE | /admin/media/:id | media:write | PATCH `{alt}`; DELETE refused (409) while a product/category uses the image |

| GET | /products/:slug/related | — (rate limited 120/min/IP) | up to 4: same category by best sellers, topped up with featured; never the product itself, drafts or hidden categories |

Storefront pages (Stage 8): `/category/<path>` (filters `sort`, `min`/`max` in rupees, `page`), `/search?q=`, `/product/<slug>`, `/cart`, `/checkout`, `/order/<id>/confirmation?token=` (no-referrer, noindex, no-store). Invalid query values are ignored rather than erroring.

## Homepage (Stage 7)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /homepage | — (cached 60 s; tags `home`, `products`, `categories`) | `{sections:[…]}` resolved for visitors; `data: null` until first saved |
| GET | /admin/homepage | home:write | `{sections, updatedAt}`; `updatedAt: null` before the first save |
| PUT | /admin/homepage | home:write | whole list + `baseUpdatedAt` (`null` only for the first save; stale => 409). Order = array order; `enabled` toggles visibility |

Section types: `hero`, `banner` (≤4), `featuredCategories` (≤8), `featuredProducts` / `latestProducts` / `bestSellers` (heading, optional category path, 1–12 products; ≤6 rails total), `richText`, `imageText`, `testimonials` (≤8), `offer` (optional `expiresAt`), `custom` (markdown + tone). ≤30 sections. Visitors never see: disabled sections, expired offers, empty rails, inactive/deleted categories (or any under an inactive parent), empty text blocks. Rails run one indexed, limited query each (in parallel) and one query covers all category sections. `/` falls back to the CMS page `home`, then to a neutral placeholder, when no homepage sections are configured.

## Cart, checkout, orders (Stage 9)
Guest checkout only in this release (customer accounts / `/account/orders` are deferred). Money is integer paise, prices tax-inclusive.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /cart/validate | — (60/min/IP) | body `{items:[{productId, variantSku?, qty 1–20}]}` (≤30 lines). Recomputes everything from the database: `{items:[{productId, variantSku, sku, name, slug, image, options, unitPrice, qty, lineTotal, available, maxQty, freeShipping}], issues:[{productId, variantSku, code:'unavailable'\|'out_of_stock'\|'reduced', message}], pricing:{subtotal, shipping, total, freeShippingOver, flatShipping}}`. Draft/archived/missing products and products in hidden categories are `available:false` and excluded from pricing; qty is clamped to stock (`reduced`). Duplicate lines are merged |
| POST | /checkout | — (10/min/IP) | header **`Idempotency-Key`** (8–80 chars `[A-Za-z0-9_-]`) required. Body `{items, email, phone, shippingAddress{name,line1,line2?,city,state,pincode(6 digits),country:'IN'}, billingSameAsShipping, billingAddress?, paymentMethod:'cod', notes?≤300}`. One transaction: re-price, atomic stock decrement (`stock >= qty` in the same update), create order. **201** `{orderId, orderNumber, accessToken, status:'confirmed', payment:{method, status}}`; **200** with the same body for a replay of the same key + same request; same key with a different request ⇒ 409. Stock short/unavailable ⇒ 409 and nothing is taken (all-or-nothing). Order number `GP-YYMM-NNNNNN` from an atomic monthly counter |
| GET | /orders/:id?token= | secret token (60/min/IP) | confirmation view: items snapshot, pricing, status, payment status, addresses, `orderNumber`, `createdAt`. Wrong token and unknown order are both 404; no notes/history/refunds are exposed; `Cache-Control: private, no-store` |
| POST | /payments/webhook | HMAC signature | generic signed webhook (see below). 120/min/IP |
| GET | /admin/orders | orders:read | `q` (order no. / email prefix, name, phone digits), `status`, `payment`, `from`/`to` (IST days, `YYYY-MM-DD`), `page`, `limit` ≤50; newest first |
| GET | /admin/orders/:id | orders:read | full order (no access token): history, notes, refunds, `allowedNext`, `refundable` |
| PATCH | /admin/orders/:id/status | orders:write | `{status, note?}`. Table: `confirmed→processing\|cancelled`, `processing→shipped\|cancelled`, `shipped→delivered`, `delivered→returned`; anything else 409. Compare-and-set on the current status (double clicks / two admins cannot both apply). **Cancel restores stock in the same transaction, exactly once** |
| PATCH | /admin/orders/:id/payment | orders:write | `{status:'paid'\|'failed'}` (COD: record cash received). `pending→paid\|failed`, `failed→paid`; not on cancelled orders; paid can only change through a refund |
| POST | /admin/orders/:id/notes | orders:write | `{text}` internal note with author + time |
| POST | /admin/orders/:id/refund | orders:refund (admin, superadmin) | `{amount (paise), reason}`; records the refund only (no gateway call). Compare-and-set on `refundedTotal`, so concurrent refunds can never exceed the total; sets `partially_refunded` / `refunded` |
| GET | /admin/orders/export | orders:read | CSV of the filtered list, newest first, ≤5000 rows, streamed; cells starting with `= + - @` (or tab/CR) get a leading `'` (formula injection) |

All admin writes append an entry (kind, status, note, actor, time) to the order's `history`.

**Payment provider slot.** The owner has not chosen a gateway. `src/server/payments/provider.ts` defines `PaymentProvider`; only `cod` exists (order is `confirmed`, payment `pending` until an admin marks it paid). To add a gateway: implement the interface, register it, add its id to `PAYMENT_METHODS`, and map its webhook onto the generic event below (or add a provider-specific route that verifies its own signature and calls `applyPaymentEvent`).

**Generic webhook** `POST /payments/webhook`: header `x-signature` = hex HMAC-SHA256 of the **raw body** with `PAYMENT_WEBHOOK_SECRET` (≥16 chars; 503 `NOT_CONFIGURED` when unset). Verified (constant time) before parsing; body ≤64 KB. Body `{eventId, type:'payment.succeeded'\|'payment.failed'\|'payment.refunded', timestamp (epoch s/ms or ISO), orderNumber \| providerOrderId \| providerPaymentId, amount? (paise)}`. The signed timestamp must be within ±5 min (replay window). Idempotent on `eventId` (unique index, committed in the same transaction as the order change): duplicates return 200 `{received:true, duplicate:true}`. `succeeded` is `pending/failed→paid` (amount, if sent, must equal the order total), `failed` is `pending→failed` only (never undoes a payment), `refunded` records a guarded refund (default: the remainder). Unknown order ⇒ 404; the same `providerPaymentId` on two orders ⇒ 409.

Env: `SHIPPING_FLAT_PAISE` (default 5000), `FREE_SHIPPING_OVER_PAISE` (default 99900), `PAYMENT_WEBHOOK_SECRET`. Shipping is free at/above the threshold, or if any product in the order has `freeShipping`.

## SEO (Stage 10)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /sitemap.xml | — (cached, tags `pages`/`products`/`categories`) | live CMS pages, visible categories, active products outside hidden categories; `noindex` items, drafts and private routes excluded; ≤50k URLs |
| GET | /robots.txt | — | disallows `/admin`, `/api/`, `/cart`, `/checkout`, `/order/`, `/preview/`, `/search`, `/login` |
| GET/PUT | /admin/seo | seo:write | site name, default title/description/share image, Twitter handle, logo, homepage title/description; PUT needs `baseUpdatedAt` (`null` for the first save) |
| GET/POST | /admin/redirects | seo:write | list (`q`, `page`, `limit` ≤50); POST `{from, to}` (path → path or https URL). Chains collapsed, loops refused, internal paths (`/admin`, `/api`, `/_next`, `/login`, `/order`, `/preview`, `/`) cannot be sources |
| DELETE | /admin/redirects/:id | seo:write | |

**Proxy (before rendering):** malformed URL → `400`; recorded redirect → `301` (query string kept); unknown `/product/<slug>`, `/category/<path>` or CMS slug → real `404` (rewritten to `/page-not-found`). Lookups are cached per instance (redirect table 60 s, existence 60 s positive / 15 s negative), so a new redirect can take up to a minute to apply. Redirects are written automatically when a product, category (with subtree) or CMS page changes URL.

**Metadata:** every storefront page has a title (`%s — <site name>`; homepage uses its own title as-is), description, canonical (absolute, from `SITE_URL`), Open Graph and Twitter tags. Sorted/filtered category listings are `noindex, follow` with the plain listing as canonical; page 2+ is indexable with its own canonical and a "page N" title. Search, cart, checkout, order and preview pages are `noindex`. JSON-LD: `Product` (+ `Offer`/`AggregateOffer`, INR, availability) and `BreadcrumbList` on product pages, `BreadcrumbList` on categories, `Organization` + `WebSite` (with `SearchAction`) on the homepage.

Settings beyond SEO (shipping/tax live in env for now), dashboard and customers APIs are not built yet.

## Rate limits (Stage 11)
Exceeding a limit returns `429 RATE_LIMITED` with `Retry-After` (seconds).

| Scope | Limit | Store |
|---|---|---|
| `POST /auth/login` | 5/min per IP+email · 30/min per IP · 20 failures/15 min per account (successes never count) | shared (MongoDB) |
| `POST /auth/register` | 5/min per IP | shared |
| `POST /checkout` | 10/min per IP | shared |
| `POST /newsletter` | 5/min per IP | shared |
| `GET /products`, `/products/:slug`, `/products/:slug/related`, `/menus/:key` | 120/min per IP | per instance |
| `POST /cart/validate`, `GET /orders/:id` | 60/min per IP | per instance |
| `/search` page | 30/min per IP (page shows a "too many searches" message) | per instance |
| `POST /admin/media` | 30/min per user | per instance |
| `POST /payments/webhook` | 120/min per IP | per instance |

"Shared" limits hold across all server instances (atomic counters in the `rateLimits` collection); "per instance" limits dampen abuse of cheap, high-volume reads without a DB round trip per request.

**Client IP:** never taken from a header the client controls. Default: the X-Forwarded-For entry appended by the single trusted proxy (`TRUSTED_PROXY_HOPS=1`, e.g. Vercel or one nginx); set `TRUSTED_PROXY_HOPS=2` behind CDN + load balancer, or `CLIENT_IP_HEADER` (e.g. `cf-connecting-ip`) when the edge overwrites a dedicated header. `X-Real-IP` is ignored unless configured that way.

**Security headers (every response):** `Content-Security-Policy` (`default-src 'self'`; scripts self + inline (required by prerendered shells, no nonces with `cacheComponents`); images self/data/blob/https; `connect-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; plus `upgrade-insecure-requests` on https sites), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and HSTS (1 year) when `SITE_URL` is https at build time. No `X-Powered-By`.

**Audit log:** `POST /admin/users` and `PATCH /admin/users/:id` record actor, action, target, changed field names (never values) and IP in `auditLogs`. Order changes keep their own per-order history with the actor.
