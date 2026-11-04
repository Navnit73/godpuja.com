# Database Schema (MongoDB / Mongoose)

All collections have `createdAt`, `updatedAt` (Mongoose timestamps). IDs are ObjectId. References are by id; small denormalised snapshots are used where history matters (orders).

## users
`name, email (unique, lowercase), passwordHash, tokenVersion (int, bumped on role/active/password change to revoke sessions), role ('superadmin'|'admin'|'store_manager'|'content_manager'|'temple_ops_manager'|'temple_operator'|'provider_manager'|'booking_manager'|'support_agent'|'customer'; legacy 'editor'/'manager' read as content_manager/store_manager until `npm run migrate:stage12`), templeIds[ObjectId] (temples a temple_operator may manage; ignored for other roles), emailVerifiedAt|null, googleSub? (OIDC subject), prefs{country,language,currency,timezone}, phone?, addresses[{label,name,phone,line1,line2,city,state,postalCode,country (ISO 3166-1 alpha-2),isDefault}], isActive, lastLoginAt`
Indexes: `{email:1}` unique; `{role:1}`; `{googleSub:1}` unique partial (string). `passwordHash` is optional since Stage 13 (Google-only accounts).

## categories
`name, slug (single kebab segment), parent (ref categories|null), path (e.g. "puja-kits/diwali"), level (1–3), description, image{url,alt}, order, isActive, seo{title,description,canonical,ogImage,noindex}`
Indexes: `{path:1}` unique; `{parent:1, order:1}`; `{isActive:1}`.
`path` is recomputed (with the whole subtree) when slug/parent changes, in one transaction, and a 301 is recorded for every moved URL (`/shop/<path>`; `/category/<path>` before Stage 14). Moving under own descendant or beyond 3 levels is rejected. Delete is refused while it has subcategories or products. Structural writes run in transactions and bump `treeVersion` on the parents involved so concurrent moves/creates/deletes conflict and retry (no cycles/orphans). Inactive categories hide their subtree and products.

## products
`name, slug (unique), sku (unique, upper-case), shortDescription, description (Markdown, sanitised when rendered), images[{url,alt,order}], category (ref), brand, price, salePrice?, effectivePrice (= salePrice ?? price, denormalised for filter/sort), stock, lowStockThreshold, status ('draft'|'active'|'archived'), isFeatured, attributes[{name,value}], variants[{sku,options{},price?,salePrice?,stock}], shipping{weightGrams,length,width,height,freeShipping}, soldCount, seo{title,description,canonical,ogImage,noindex}, schemaOverrides?`
Indexes: `{slug:1}` unique; `{sku:1}` unique; `{variants.sku:1}` unique (partial); `{status:1, category:1, createdAt:-1}`; `{status:1, isFeatured:1, createdAt:-1}`; `{status:1, createdAt:-1}`; `{status:1, soldCount:-1}`; `{status:1, effectivePrice:1}`; `{updatedAt:-1}`; text index `{name, shortDescription, brand}`.
Rules: `salePrice < price`; money in integer paise; if `variants` exist, stock is per-variant (SKUs unique across all products incl. variants). **Stock is never written by the product editor**: edits keep current stock (variants matched by SKU) and stock changes only through `adjustStock` (single atomic update with a `stock >= -delta` guard, `timestamps:false` so it doesn't invalidate editors). Activating needs a category and a price. A slug change records a 301 (`/product/<old>` → `/product/<new>`).

## pages
`title, slug (unique), description, sections[{id,type,enabled,data}], status ('draft'|'published'|'scheduled'), publishAt?, publishedAt?, previewToken, seo{…}`
Indexes: `{slug:1}` unique; `{status:1, publishAt:1}`.

## menus
`key (unique, kebab-case; storefront uses 'header' and optional 'mobile'), name, items[ menuItem ]` where `menuItem = {id, label, type('page'|'external'; 'category'|'product' added in Stage 6), ref? (page _id), url?, openInNewTab, enabled, showOnDesktop, showOnMobile, children:[menuItem]}` (≤3 levels, ≤100 items). Order = array order; a node with children is a dropdown (no separate `isDropdown`/`order` fields). Page links store the page id, so slug changes never break a menu. Timestamps used for optimistic concurrency.
Embedded (a menu is always read whole). Index: `{key:1}` unique.

## footer (single doc)
`key ('main', unique), columns[{id,heading,enabled,links[link]}] (≤6 cols, ≤12 links), social[{id,platform,url(https),enabled}], contact{address,phone,email}, newsletter{enabled,heading,text}, legalLinks[link] (≤8), copyright ('{year}' placeholder)` where `link = {id,label,type('page'|'external'),ref?,url?,openInNewTab,enabled}` (same link rules as menus). Order = array order. Optimistic concurrency on `updatedAt`; the first save is create-only (unique key).

## subscribers
`email (unique, lowercase), source, createdAt`. Written by the public newsletter endpoint (idempotent upsert).

## homepage (single doc)
`key ('main', unique), sections[{id,type,enabled,data}]` — order = array order; ≤30 sections, ≤6 product rails. Types and `data`: `hero{heading,subheading,imageUrl,imageAlt,ctaLabel,ctaUrl,secondaryCtaLabel,secondaryCtaUrl}`, `banner{items[{imageUrl,imageAlt,heading,text,linkUrl}] ≤4}`, `featuredCategories{heading,categoryIds[≤8]}`, `featuredProducts|latestProducts|bestSellers{heading,category(path|''),limit 1–12}`, `richText{markdown}`, `imageText{…as pages}`, `testimonials{heading,items[{quote,author,role}] ≤8}`, `offer{heading,text,code,ctaLabel,ctaUrl,expiresAt|''}`, `custom{markdown,tone}`. Optimistic concurrency on `updatedAt`; first save is create-only.

## orders
`orderNumber (unique, "GP-YYMM-NNNNNN"), idempotencyKey (unique), user (ObjectId|null: signed-in checkout or a guest order claimed after email verification), requestHash (sha256 of the normalised request; a reused key with a different request is rejected), accessToken (unique, 192-bit; the guest's only credential), email, phone, shippingAddress{name,line1,line2?,city,state,postalCode,country (ISO alpha-2)}, billingAddress, customerNote, items[{product (ref), variantSku|null, name, slug, sku, image{url,alt}|null, options{}, unitPrice, qty, lineTotal}], currency (ISO 4217, required; all amounts are integer minor units of it), pricing{subtotal,discount,shipping,tax,total}, status ('pending_payment'|'payment_failed'|'confirmed'|'processing'|'shipped'|'delivered'|'return_requested'|'returned'|'cancelled'|'refunded'), payment{provider,method,providerOrderId?,providerPaymentId?,status('pending'|'paid'|'failed'|'refunded'|'partially_refunded'),paidAt?}, refunds[{amount,reason,at,by}], refundedTotal, notes[{text,by,at}], history[{kind('created'|'status'|'payment'|'refund'|'note'|'webhook'),status,note,by{id,name},at}]`
Indexes: `{orderNumber}` unique; `{idempotencyKey}` unique; `{accessToken}` unique; `{status, createdAt:-1, _id:-1}`; `{payment.status, createdAt:-1, _id:-1}`; `{email, createdAt:-1}`; `{createdAt:-1, _id:-1}`; `{payment.providerPaymentId}` unique sparse; `{payment.providerOrderId}` sparse. (The list sorts are served from the indexes; verified with `explain()` in `tests/orders.test.ts`.) `{user, createdAt:-1, _id:-1}` partial (account order history). Stage 14b: `coupon {id, code, type, discount}` snapshot and `pricing.taxName/taxRateBps/taxInclusive`. Stage 14 fields: `shipments[{id, carrier, trackingNumber, trackingUrl|null, shippedAt, by}]`, `deliveredAt` (starts the return window), `returnRequest{reason, at, status ('requested'|'accepted'|'declined'), source ('customer'|'staff'), decidedAt?, decisionNote?}`; history kinds add `shipment` and `return`. Pre-Stage-12 rows (`pincode`, no `currency`) are read through `normalizeAddress` / INR fallback and rewritten by `npm run migrate:stage12`.

## coupons (Stage 14)
`code (unique, upper-case), description, type ('percent'|'fixed'|'free_shipping'), value (int), maxDiscount|null, minSubtotal, startsAt|null, expiresAt|null, usageLimit|null, usedCount, perCustomerLimit|null (default 1), isActive`. Index `{isActive, createdAt:-1}`.

## couponUses
`_id "<couponId>:<email>", coupon, count` — per-customer redemption counter. Incremented with a guarded upsert (`count < limit`); a failed guard collides on `_id`, which means "limit reached".

## taxRules
`country (unique, ISO), name, rateBps (int 0–10000), inclusive, appliesToShipping, isActive`.

## counters
`_id ("order-YYMM"), n`. One atomic `$inc` upsert per order number; numbers may be skipped (a checkout that later fails) but are never reused.

## authTokens (Stage 13)
`user, kind ('verify_email'|'password_reset'), tokenHash (sha256, unique; the raw token is only in the email), email (the address it was sent to), expiresAt (TTL index), usedAt|null`. Consumed with one atomic `findOneAndUpdate` (single use under concurrency). Index `{user, kind}`.

## notifications (Stage 13)
`channel ('email'), to, template, subject, ref{kind,id}|null, state ('queued'|'sent'|'failed'|'skipped'), provider, providerId, error` — delivery log only, no bodies or links. Indexes `{ref.kind, ref.id, createdAt:-1}`, `{state, createdAt:-1}`, TTL 1 year.

## payments (Stage 13 — immutable ledger, PRD v1.1 §14.1)
`kind ('order'|'booking'|'donation'), refId, refNumber, type ('charge'|'refund'), provider, method, providerRef|null, amount (>0, integer minor units), currency (ISO 4217), fee, tax, net (= amount − fee), note, actor{id,name}, createdAt`. Update operations are blocked at the model level. Indexes `{kind, refId, createdAt}`, `{kind, createdAt:-1}`, `{provider, providerRef, type}` unique partial.

## webhookEvents
`provider, eventId, type, order, createdAt`. Unique `{provider, eventId}` makes webhook handling idempotent; TTL 90 days.

Snapshots of name/price/SKU keep orders correct after product edits.

> Page `category` assignment is deferred to Stage 6 (categories do not exist yet). `publishedAt` is the go-live time (set on publish; equals `publishAt` for scheduled pages). `previewToken` is unique and rotatable. Edits use optimistic concurrency on `updatedAt`.

## locks
Single document `{_id: "superadmin-guard", n}` written inside transactions that remove a superadmin, so concurrent demotions conflict and retry (see `services/users.ts`).

## redirects
`from (unique, normalised path), to, code (301), hits`. Index `{from:1}` unique. Written in the same transaction as the slug/path change (products, categories) or right after it (CMS pages), plus manual entries from /admin/seo; kept loop- and chain-free; cleared when a URL becomes a real page again and when its target is deleted. Read by the proxy (cached 60 s).

## media
`url, publicId, filename, mime, size, width, height, alt, uploadedBy`. Index `{createdAt:-1}`.

## settings (single doc)
`key ('main', unique), siteName, defaultTitle, defaultDescription, defaultOgImage, twitterHandle, logoUrl, homeTitle, homeDescription` (Stage 10, SEO only). Site URL comes from the `SITE_URL` env; shipping rules from env (Stage 9). Optimistic concurrency on `updatedAt`; first save create-only.

## auditLogs
`action ("user.create" | "user.update"), actor {id (ref users), name}, target {type, id}, fields [changed field names — never values], ip, createdAt`. Indexes `{target.type:1, target.id:1, createdAt:-1}`, `{createdAt:-1}`. Append-only; no TTL (Stage 11). Orders keep their own `history` with the actor.

## rateLimits
`_id ("<key>@<windowStart>"), n, expiresAt`. One document per limited key per fixed window, incremented with an atomic `$inc` upsert; TTL index on `expiresAt` removes it after the window (Stage 11). Used for login, registration, checkout and newsletter limits so they hold across instances.

## carts
Not persisted in v1 (client state, server-validated at checkout).

## Relationships

```
categories 1─* categories (parent)      categories 1─* products
pages *─1 categories                    menus.items ─ref→ pages|categories|products
orders *─1 users (optional guest)       orders.items ─snapshot→ products
users 1─* auditLogs                     media referenced by URL
```
