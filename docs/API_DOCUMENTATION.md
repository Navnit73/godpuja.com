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
| POST | /auth/register | — | `{name,email,password}`; customer role only (a `role` in the body is ignored). **Open by default since Stage 13**; `ALLOW_PUBLIC_REGISTRATION=false` closes it (403). Signs in and emails a verification link |
| GET | /auth/me | auth | current user |

## Users & roles (Stage 2)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /admin/users | users:read | `q`, `role`, `page`, `limit` (≤50); `meta {total,page,limit,pages}` |
| POST | /admin/users | users:write | `{name,email,password,role,templeIds?}` — roles per PRD v1.1 §12 (Stage 12); `templeIds` (ObjectIds, ≤100, deduplicated) limit a `temple_operator` to those temples |
| GET | /admin/users/:id | users:read | |
| PATCH | /admin/users/:id | users:write | any of `name, role, isActive, password, templeIds`; unknown keys ignored. Legacy role names (`editor`, `manager`) are rejected on write |

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

Storefront pages (Stage 8; categories moved to `/shop` in Stage 14): `/shop` (everything, with a category list) and `/shop/<category path>` (filters `sort`, `min`/`max` in rupees, `page`), `/search?q=`, `/product/<slug>`, `/cart`, `/checkout`, `/order/<id>/confirmation?token=` (no-referrer, noindex, no-store). Invalid query values are ignored rather than erroring.

## Homepage (Stage 7)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /homepage | — (cached 60 s; tags `home`, `products`, `categories`) | `{sections:[…]}` resolved for visitors; `data: null` until first saved |
| GET | /admin/homepage | home:write | `{sections, updatedAt}`; `updatedAt: null` before the first save |
| PUT | /admin/homepage | home:write | whole list + `baseUpdatedAt` (`null` only for the first save; stale => 409). Order = array order; `enabled` toggles visibility |

Section types: `hero`, `banner` (≤4), `featuredCategories` (≤8), `featuredProducts` / `latestProducts` / `bestSellers` (heading, optional category path, 1–12 products; ≤6 rails total), `richText`, `imageText`, `testimonials` (≤8), `offer` (optional `expiresAt`), `custom` (markdown + tone). ≤30 sections. Visitors never see: disabled sections, expired offers, empty rails, inactive/deleted categories (or any under an inactive parent), empty text blocks. Rails run one indexed, limited query each (in parallel) and one query covers all category sections. `/` falls back to the CMS page `home`, then to a neutral placeholder, when no homepage sections are configured.

## Cart, checkout, orders (Stage 9)
Guest checkout only in this release (customer accounts / `/account/orders` are Stage 13). Money is integer minor units with an ISO 4217 code: catalogue prices are in `BASE_CURRENCY` (INR, `lib/money.ts`), every order stores `currency`, and cart/checkout/order responses include it. Prices are tax-inclusive.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /cart/validate | — (60/min/IP) | body `{items:[{productId, variantSku?, qty 1–20}]}` (≤30 lines). Recomputes everything from the database: `{items:[{productId, variantSku, sku, name, slug, image, options, unitPrice, qty, lineTotal, available, maxQty, freeShipping}], issues:[{productId, variantSku, code:'unavailable'\|'out_of_stock'\|'reduced', message}], pricing:{subtotal, shipping, total, freeShippingOver, flatShipping}}`. Draft/archived/missing products and products in hidden categories are `available:false` and excluded from pricing; qty is clamped to stock (`reduced`). Duplicate lines are merged |
| POST | /checkout | — (10/min/IP) | header **`Idempotency-Key`** (8–80 chars `[A-Za-z0-9_-]`) required. Body `{items, email, phone, shippingAddress{name,line1,line2?,city,state,postalCode,country}, billingSameAsShipping, billingAddress?, paymentMethod:'cod', notes?≤300}`. `country` is ISO 3166-1 alpha-2; postal code and state rules are per country (`lib/address.ts`: IN 6-digit PIN + state required, US ZIP, CA, GB, AU, NZ, SG, AE/HK no postcode, generic otherwise). The **shipping** country must be in `SHIPPING_COUNTRIES` (else 400 with field `shippingAddress.country`, before any stock is taken); billing may be any country. One transaction: re-price, atomic stock decrement (`stock >= qty` in the same update), create order. **201** `{orderId, orderNumber, accessToken, status, currency, payment:{method, status}}` — `status` is `confirmed` for COD, `pending_payment` for an online gateway (confirmed only when payment succeeds); **200** with the same body for a replay of the same key + same request; same key with a different request ⇒ 409. Stock short/unavailable ⇒ 409 and nothing is taken (all-or-nothing). Order number `GP-YYMM-NNNNNN` from an atomic monthly counter |
| GET | /orders/:id?token= | secret token (60/min/IP) | confirmation view: items snapshot, pricing, status, payment status, addresses, `orderNumber`, `createdAt`. Wrong token and unknown order are both 404; no notes/history/refunds are exposed; `Cache-Control: private, no-store` |
| POST | /payments/webhook | HMAC signature | generic signed webhook (see below). 120/min/IP |
| GET | /admin/orders | orders:read | `q` (order no. / email prefix, name, phone digits), `status`, `payment`, `from`/`to` (whole local days in `ADMIN_TIMEZONE`, `YYYY-MM-DD`), `page`, `limit` ≤50; newest first |
| GET | /admin/orders/:id | orders:read | full order (no access token): history, notes, refunds, `allowedNext`, `refundable` |
| PATCH | /admin/orders/:id/status | orders:write | `{status, note?}` with status one of `processing, shipped, delivered, return_requested, returned, cancelled`. Table: `pending_payment\|payment_failed→cancelled`, `confirmed→processing\|cancelled`, `processing→shipped\|cancelled`, `shipped→delivered`, `delivered→return_requested\|returned`, `return_requested→returned\|delivered` (declined); anything else 409. `confirmed`, `payment_failed` and `refunded` are never set by hand: payment updates and full refunds drive them. Compare-and-set on the current status (double clicks / two admins cannot both apply). **Cancel restores stock in the same transaction, exactly once** |
| PATCH | /admin/orders/:id/payment | orders:write | `{status:'paid'\|'failed'}` (COD: record cash received). `pending→paid\|failed`, `failed→paid`; not on cancelled/refunded orders; paid can only change through a refund. Paid moves `pending_payment\|payment_failed` orders to `confirmed`; failed moves `pending_payment` to `payment_failed` |
| POST | /admin/orders/:id/notes | orders:write | `{text}` internal note with author + time |
| POST | /admin/orders/:id/refund | orders:refund (admin, superadmin) | `{amount (paise), reason}`; records the refund only (no gateway call). Compare-and-set on `refundedTotal`, so concurrent refunds can never exceed the total; sets `partially_refunded` / `refunded`; a **cancelled or returned** order refunded in full moves to order status `refunded` (compare-and-set on status too) |
| GET | /admin/orders/export | orders:read | CSV of the filtered list (columns include postal code, country and currency; amounts as decimals of the order currency), newest first, ≤5000 rows, streamed; cells starting with `= + - @` (or tab/CR) get a leading `'` (formula injection) |

All admin writes append an entry (kind, status, note, actor, time) to the order's `history`.

**Payment provider slot.** The owner has not chosen a gateway. `src/server/payments/provider.ts` defines `PaymentProvider`; only `cod` exists (`confirmsOnPlacement: true`: order is `confirmed`, payment `pending` until an admin marks it paid). A gateway sets `confirmsOnPlacement: false`, so its orders start `pending_payment`. To add a gateway: implement the interface, register it, add its id to `PAYMENT_METHODS`, and map its webhook onto the generic event below (or add a provider-specific route that verifies its own signature and calls `applyPaymentEvent`).

**Generic webhook** `POST /payments/webhook`: header `x-signature` = hex HMAC-SHA256 of the **raw body** with `PAYMENT_WEBHOOK_SECRET` (≥16 chars; 503 `NOT_CONFIGURED` when unset). Verified (constant time) before parsing; body ≤64 KB. Body `{eventId, type:'payment.succeeded'\|'payment.failed'\|'payment.refunded', timestamp (epoch s/ms or ISO), orderNumber \| providerOrderId \| providerPaymentId, amount? (minor units), currency? (ISO 4217, must match the order or 400)}`. The signed timestamp must be within ±5 min (replay window). Idempotent on `eventId` (unique index, committed in the same transaction as the order change): duplicates return 200 `{received:true, duplicate:true}`. `succeeded` is `pending/failed→paid` (amount, if sent, must equal the order total) and confirms a `pending_payment`/`payment_failed` order, `failed` is `pending→failed` only (never undoes a payment) and moves `pending_payment` to `payment_failed`, `refunded` records a guarded refund (default: the remainder). Unknown order ⇒ 404; the same `providerPaymentId` on two orders ⇒ 409.

Env: `SHIPPING_FLAT_PAISE` (default 5000), `FREE_SHIPPING_OVER_PAISE` (default 99900), `PAYMENT_WEBHOOK_SECRET`, `SHIPPING_COUNTRIES` (comma-separated ISO codes, default `IN`), `ADMIN_TIMEZONE` (IANA zone, default `Asia/Kolkata`). Shipping is free at/above the threshold, or if any product in the order has `freeShipping`.

## SEO (Stage 10)
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | /sitemap.xml | — (cached, tags `pages`/`products`/`categories`) | live CMS pages, visible categories, active products outside hidden categories; `noindex` items, drafts and private routes excluded; ≤50k URLs |
| GET | /robots.txt | — | disallows `/admin`, `/api/`, `/cart`, `/checkout`, `/order/`, `/preview/`, `/search`, `/login` |
| GET/PUT | /admin/seo | seo:write | site name, default title/description/share image, Twitter handle, logo, homepage title/description; PUT needs `baseUpdatedAt` (`null` for the first save) |
| GET/POST | /admin/redirects | seo:write | list (`q`, `page`, `limit` ≤50); POST `{from, to}` (path → path or https URL). Chains collapsed, loops refused, internal paths (`/admin`, `/api`, `/_next`, `/login`, `/order`, `/preview`, `/`) cannot be sources |
| DELETE | /admin/redirects/:id | seo:write | |

**Proxy (before rendering):** malformed URL → `400`; recorded redirect → `301` (query string kept); unknown `/product/<slug>`, `/shop/<path>` or CMS slug → real `404` (rewritten to `/page-not-found`). Lookups are cached per instance (redirect table 60 s, existence 60 s positive / 15 s negative), so a new redirect can take up to a minute to apply. Redirects are written automatically when a product, category (with subtree) or CMS page changes URL.

**Metadata:** every storefront page has a title (`%s — <site name>`; homepage uses its own title as-is), description, canonical (absolute, from `SITE_URL`), Open Graph and Twitter tags. Sorted/filtered category listings are `noindex, follow` with the plain listing as canonical; page 2+ is indexable with its own canonical and a "page N" title. Search, cart, checkout, order and preview pages are `noindex`. JSON-LD: `Product` (+ `Offer`/`AggregateOffer`, INR, availability) and `BreadcrumbList` on product pages, `BreadcrumbList` on categories, `Organization` + `WebSite` (with `SearchAction`) on the homepage.

Settings beyond SEO (shipping/tax live in env for now), dashboard and customers APIs are not built yet.

## Customer accounts & notifications (Stage 13)
All `/account` endpoints need a signed-in user (any role) and only ever touch that user's own data; another user's order or address is a 404.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /auth/verify-email | — (20/15 min/IP) | `{token}` from the emailed link. Single use, 24 h, void if the account email changed. Marks the email verified and **claims guest orders** placed with that email (`user: null` → this user). 200 `{verified, claimedOrders}`; bad/used/expired ⇒ 400 field `token`. POST (not GET) so email link scanners cannot burn the token |
| POST | /auth/verify-email/resend | signed in (3/h/user) | new link; older links stop working. `{state: sent\|skipped\|failed\|already_verified}` |
| POST | /auth/forgot-password | — (5/15 min/IP, 3/h/email) | `{email}`. Always 200 `{sent:true}` (no account enumeration); only active accounts get an email, sent after the response |
| POST | /auth/reset-password | — (10/15 min/IP) | `{token, password}`. Single use, 1 h. Sets the password, bumps `tokenVersion` (signs out every session), marks the email verified, revokes other reset links, claims guest orders, signs this browser in. 200 `{reset, role}` |
| GET | /auth/google?next= | — (20/15 min/IP) | Starts OpenID Connect (code + PKCE S256 + state + nonce); flow secrets in a signed httpOnly cookie (`gp_oauth`, 10 min, path `/api/auth/google`). 303 to Google, or to `/login?error=google_unavailable` when not configured |
| GET | /auth/google/callback | — | Verifies state (constant time), exchanges the code, verifies the ID token (RS256 via Google JWKS, issuer, audience, expiry, nonce, `email_verified`). Known Google id ⇒ sign in; existing **customer** with that email ⇒ link + verify; **staff accounts are never reachable through Google** (also if promoted later); otherwise creates a customer. Claims guest orders. Errors redirect to `/login?error=google_*` |
| GET / PATCH | /account/profile | signed in | `{name?, phone?, prefs?{country (ISO), language en\|hi, currency (ISO 4217, display only), timezone (IANA)}}`. Response includes `emailVerified, hasPassword, google` |
| POST | /account/password | signed in (5/15 min/user) | `{currentPassword?, newPassword}`; current required when a password exists (Google-only accounts can set one). Signs out other sessions, re-issues this cookie |
| GET / POST | /account/addresses | signed in | list (default first) / add (`{label?, name, line1, line2?, city, state, postalCode, country, phone?, isDefault?}`, country rules as checkout). ≤10 per account (atomic); the first is the default |
| PATCH / DELETE | /account/addresses/:id | signed in | edit (`isDefault:true` makes it the only default) / remove (the default moves to the first remaining) |
| GET | /account/orders?page= | signed in | the user's orders, newest first, 10 per page; `meta {total,page,limit,pages}` |
| GET | /account/orders/:id | signed in | customer view (no notes/history/refunds); `private, no-store` |

**Checkout (signed in):** the order gets `user`; body may add `saveAddress: true` to keep the shipping address (skipped if already saved or at the limit; never fails the order). The session is read from the request's own `Cookie` header.

**Notifications:** sent after the response (`after()`), never blocking or failing the action, and logged in `notifications` (template, recipient, record ref, delivery state; no message body). Templates: `account.verify_email`, `account.password_reset`, `order.placed`, `order.status.{confirmed,shipped,delivered,cancelled,returned,refunded}`, `order.refund`. Internal status notes are never emailed. Provider: Resend over HTTPS (`RESEND_API_KEY`, `EMAIL_FROM`); without them every email is logged `skipped` (and printed in development).

**Payment ledger:** every charge (admin "Mark as paid", webhook `payment.succeeded`) and refund (admin, webhook) appends an immutable `payments` row in the **same transaction** as the order change. A provider reference is recorded once per type. Admin order detail shows the order's ledger.

## Store URLs, fulfilment, returns, invoices (Stage 14, slice 1)
**URLs (PRD v1.1 §3.1):** `/shop` lists all products; `/shop/<category path>` is a category; products stay `/product/<slug>`. Any `/category/...` URL gets a permanent `301` to `/shop/...` (query string kept), and redirects stored before Stage 14 are followed in one hop. New category moves record `/shop/...` redirects. `npm run migrate:stage14` rewrites stored `/category/` redirects. The sitemap lists `/shop`. Menus/footer can link to "Shop (all products)".

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /admin/orders/:id/shipments | orders:write | `{carrier (delhivery\|dhl\|fedex\|ups\|india-post\|bluedart\|dtdc\|other), trackingNumber (5–40 letters/digits/dashes), trackingUrl? (https only)}`. Allowed while the order is processing, shipped or delivered; a duplicate number on the order ⇒ 409. Does not change the status. Emails the customer the tracking. 201 returns the order |
| DELETE | /admin/orders/:id/shipments/:sid | orders:write | removes a wrongly entered shipment (logged in history, no email) |
| POST | /account/orders/:id/cancel | signed in (10/15 min) | owner only; allowed while `pending_payment`, `payment_failed` or `confirmed`; stock returns exactly once; else 409 "contact us". Not the owner / guest order ⇒ 404 |
| POST | /account/orders/:id/return | signed in (10/15 min) | `{reason (5–500)}`; owner only; order must be `delivered`, within `RETURN_WINDOW_DAYS` (default 7, 0 = off) of `deliveredAt`, and never requested before. Moves it to `return_requested` (compare-and-set: concurrent requests record one) and emails the customer |

`GET /account/orders/:id` now also returns `shipments` (with tracking links), `deliveredAt`, `returnRequest` and `actions {canCancel, canReturn, returnDeadline}`; the guest token view returns shipments and the return request but never `actions`. Staff decide a return with the existing status endpoint: `return_requested → returned` accepts it, `→ delivered` declines it (a note is stored and emailed; the customer cannot request again). Accepting does not refund or restock automatically. Staff can also record a return themselves (`return_requested`, source `staff`).

**Tracking links:** built only where the carrier's public tracking URL takes the number (Delhivery, DHL, FedEx, UPS); for others the number is shown, or a staff-supplied `https` page is linked. Never any other URL scheme. The carrier URL templates are not verified against live carrier sites.

**Invoice** `/account/orders/:id/invoice` (signed in, owner only): printable (print view hides the site chrome), shown for confirmed orders onward and not for unpaid or cancelled ones. Seller details come from env `SELLER_NAME` (default: site name), `SELLER_ADDRESS`, `SELLER_TAX_ID` (printed only when set). Tax appears as a line when an order carries tax.

Env: `RETURN_WINDOW_DAYS`, `SELLER_NAME`, `SELLER_ADDRESS`, `SELLER_TAX_ID`.

## Coupons and tax (Stage 14, slice 2)
**Pricing** is assembled in one place (`lib/pricing.ts`, integer minor units): `total = subtotal − discount + shipping + tax added on top`. With no coupon and no tax rule nothing changes.

`POST /cart/validate` now also accepts `couponCode?` and `country?` (ISO, the delivery country) and returns `pricing {currency, subtotal, discount, shipping, tax, taxName|null, taxRateBps, taxInclusive, total, …}`, `coupon {code, type, discount}|null` and `couponError|null`. A bad code never fails the cart: it comes back as a message and the cart is priced without it. The same code path prices the order, so the cart, checkout and order always agree.

`POST /checkout` accepts `couponCode?`. Inside the order transaction the code is re-checked and **counted atomically**: the total-uses counter only increments while below the limit, and the per-customer counter (keyed by lower-cased email) is a guarded upsert, so concurrent checkouts can never exceed either limit; a failed order (stock, validation) leaves the coupon untouched. An invalid code is `400` with field `couponCode`; a limit reached is `409` with the same field. The idempotency hash includes the code. **Cancelling an order gives its coupon use back.** Orders keep a snapshot (`coupon {id, code, type, discount}`, and `pricing.taxName/taxRateBps/taxInclusive`), so editing or deleting a coupon or tax rule never changes a past order.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET / POST | /admin/coupons | coupons:write (store manager, admin, superadmin) | list / create `{code (3–30 A–Z 0–9 _ -), description?, type (percent\|fixed\|free_shipping), value (percent 1–100; fixed in minor units), maxDiscount? (percent only), minSubtotal?, startsAt?, expiresAt?, usageLimit? (null = unlimited), perCustomerLimit? (null = unlimited), isActive}`. Duplicate code ⇒ 409 |
| GET / PATCH / DELETE | /admin/coupons/:id | coupons:write | PATCH needs `baseUpdatedAt` (stale ⇒ 409) and the **code cannot change** (⇒ 400). DELETE is allowed any time and clears the per-customer counters |
| GET / POST | /admin/tax-rules | tax:write (admin, superadmin only) | `{country (ISO), name, rateBps (1800 = 18%), inclusive, appliesToShipping, isActive}`; one rule per country (duplicate ⇒ 409) |
| PATCH / DELETE | /admin/tax-rules/:id | tax:write | PATCH needs `baseUpdatedAt`; the country cannot change |

Customer-facing messages: unknown and switched-off codes both say "This code is not valid." (codes cannot be probed); also "not active yet", "has expired", "has been fully used", "Spend at least ₹X…", "You have already used this code." Coupon and tax changes are audit-logged.

**Tax rules:** destination = the shipping country. *Inclusive* tax is already in the prices (reported on the order, total unchanged); *exclusive* tax is added to the total. Tax is calculated on goods after discount, plus shipping only when the rule says so. No rule for a country = no tax line. Rounding: round half up, once per formula. Shipping rates are still not destination-dependent.

## Reviews, filters, wishlist, recently viewed (Stage 14, slice 3)
**Reviews (verified purchase, moderated).** A customer can review a product only if one of *their* orders containing it is **delivered**; one review per product. A review (and every later edit) is `pending` until staff publish it: only `published` reviews are shown, counted in the product's rating, or used in structured data (`aggregateRating` appears only when published reviews exist, PRD §18). Reviewers are shown as first name + last initial.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /account/reviews/:slug | signed in | `{eligible, reason ('not_purchased'\|null), review|null}` |
| PUT | /account/reviews/:slug | signed in (10/h) | `{rating 1–5, title? ≤80, body 10–2000}`. Creates (201) or edits (200) the caller's review; always lands `pending`; editing a published one takes its stars out until it is approved again. Not delivered ⇒ 403 |
| DELETE | /account/reviews/:slug | signed in | removes the caller's review (and its stars if published) |
| GET | /admin/reviews?status=pending\|published\|rejected&page= | reviews:write (store manager, admin, superadmin) | oldest first (work the queue in order) |
| PATCH | /admin/reviews/:id | reviews:write | `{status: published\|rejected, note?}`. Compare-and-set on the status seen (two moderators cannot both apply); the product's rating moves in the **same transaction** |
| DELETE | /admin/reviews/:id | reviews:write | removes the review (and its stars if published) |

Product rating totals (`ratingCount`, `ratingSum`, `ratingAvg`) are changed only by atomic pipeline updates, so concurrent moderation never loses a star (tested with simultaneous approvals and withdrawals). The average is rounded **half up** to two decimals, with the same formula in code and in the database (MongoDB's `$round` rounds halves to even, which would have disagreed). Cards and the product page show stars only when there is at least one published review.

**Filters (PRD §5.2).** Listing pages (`/shop`, `/shop/<category>`, `/search`) accept `deity`, `material`, `occasion`, `size` (matched case-insensitively against product attributes of that name, as plain text, never as a pattern), `stock=1` (a product with units, or any variant with units), `rating=1..5` (minimum average, published reviews only) and `sort=rating` ("Top rated"). The filter panel offers **only values that exist** among the products being browsed, with counts; a group with no values is omitted. Every filtered or re-sorted page is `noindex, follow` with the plain listing as canonical.

**Wishlist (signed in).** `GET /account/wishlist` → `{ids}` (newest first; colours the hearts), `POST /account/wishlist {productId}` (idempotent; only visible products; up to 200), `DELETE /account/wishlist/:productId`. The page `/account/wishlist` shows the saved products that are still public. Signed-out visitors who press a heart are sent to sign in and come back.

**Recently viewed.** Kept in this browser only (`gp_recent_v1`, ≤12 slugs; nothing is sent until the cards are loaded). `POST /products/cards {slugs ≤12}` (public, 60/min/IP) returns cards for known, visible slugs in the order asked.

## Rate limits (Stage 11)
Exceeding a limit returns `429 RATE_LIMITED` with `Retry-After` (seconds).

| Scope | Limit | Store |
|---|---|---|
| `POST /auth/login` | 5/min per IP+email · 30/min per IP · 20 failures/15 min per account (successes never count) | shared (MongoDB) |
| `POST /auth/register` | 5/min per IP | shared |
| `POST /auth/forgot-password` · `reset-password` · `verify-email` · `verify-email/resend` · `/account/password` · `GET /auth/google` | see Stage 13 table | shared |
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
