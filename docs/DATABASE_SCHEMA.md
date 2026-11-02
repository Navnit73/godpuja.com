# Database Schema (MongoDB / Mongoose)

All collections have `createdAt`, `updatedAt` (Mongoose timestamps). IDs are ObjectId. References are by id; small denormalised snapshots are used where history matters (orders).

## users
`name, email (unique, lowercase), passwordHash, tokenVersion (int, bumped on role/active/password change to revoke sessions), role ('superadmin'|'admin'|'editor'|'manager'|'customer'), phone?, addresses[{label,name,phone,line1,line2,city,state,pincode,country,isDefault}], isActive, lastLoginAt`
Indexes: `{email:1}` unique; `{role:1}`.

## categories
`name, slug (single kebab segment), parent (ref categories|null), path (e.g. "puja-kits/diwali"), level (1–3), description, image{url,alt}, order, isActive, seo{title,description,canonical,ogImage,noindex}`
Indexes: `{path:1}` unique; `{parent:1, order:1}`; `{isActive:1}`.
`path` is recomputed (with the whole subtree) when slug/parent changes, in one transaction, and a 301 is recorded for every moved URL (`/category/<path>`). Moving under own descendant or beyond 3 levels is rejected. Delete is refused while it has subcategories or products. Inactive categories hide their subtree and products.

## products
`name, slug (unique), sku (unique, upper-case), shortDescription, description (Markdown, sanitised when rendered), images[{url,alt,order}], category (ref), brand, price, salePrice?, effectivePrice (= salePrice ?? price, denormalised for filter/sort), stock, lowStockThreshold, status ('draft'|'active'|'archived'), isFeatured, attributes[{name,value}], variants[{sku,options{},price?,salePrice?,stock}], shipping{weightGrams,length,width,height,freeShipping}, soldCount, seo{title,description,canonical,ogImage,noindex}, schemaOverrides?`
Indexes: `{slug:1}` unique; `{sku:1}` unique; `{variants.sku:1}` unique (partial); `{status:1, category:1, createdAt:-1}`; `{status:1, isFeatured:1}`; `{status:1, soldCount:-1}`; `{status:1, effectivePrice:1}`; `{updatedAt:-1}`; text index `{name, shortDescription, brand}`.
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
`sections[{id,type('hero'|'banner'|'featuredCategories'|'featuredProducts'|'latestProducts'|'bestSellers'|'richText'|'imageText'|'testimonials'|'offer'|'custom'),enabled,order,data}]`

## orders
`orderNumber (unique, human readable), idempotencyKey (unique), user? (ref), guestEmail?, items[{product,variantSku?,name,sku,image,unitPrice,qty,lineTotal}], pricing{subtotal,discount,shipping,tax,total}, shippingAddress, billingAddress, status, payment{provider,providerOrderId,providerPaymentId,status('pending'|'paid'|'failed'|'refunded'|'partially_refunded'),paidAt}, refunds[{amount,reason,at,by}], notes[{text,by,at}], history[{status,by,at,note}]`
Indexes: `{orderNumber:1}` unique; `{idempotencyKey:1}` unique; `{user:1, createdAt:-1}`; `{status:1, createdAt:-1}`; `{'payment.providerPaymentId':1}` sparse unique.
Snapshots of name/price/SKU keep orders correct after product edits.

> Page `category` assignment is deferred to Stage 6 (categories do not exist yet). `publishedAt` is the go-live time (set on publish; equals `publishAt` for scheduled pages). `previewToken` is unique and rotatable. Edits use optimistic concurrency on `updatedAt`.

## locks
Single document `{_id: "superadmin-guard", n}` written inside transactions that remove a superadmin, so concurrent demotions conflict and retry (see `services/users.ts`).

## redirects
`from (unique, normalised path), to, code (301), hits`. Index `{from:1}` unique. Written in the same transaction as the slug/path change; kept loop- and chain-free (Stage 10 reads it in the proxy).

## media
`url, publicId, filename, mime, size, width, height, alt, uploadedBy`. Index `{createdAt:-1}`.

## settings (single doc)
`siteName, siteUrl, logo, favicon, contact, defaultSeo{title,description,ogImage}, currency, shipping{flatRate,freeOver}, tax{inclusive,rate}, socials, analyticsId`

## auditLogs
`actor (ref users), action, entity, entityId, before?, after?, ip, at`. Index `{entity:1, entityId:1, at:-1}`; TTL optional.

## carts
Not persisted in v1 (client state, server-validated at checkout).

## Relationships

```
categories 1─* categories (parent)      categories 1─* products
pages *─1 categories                    menus.items ─ref→ pages|categories|products
orders *─1 users (optional guest)       orders.items ─snapshot→ products
users 1─* auditLogs                     media referenced by URL
```
