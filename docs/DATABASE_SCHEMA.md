# Database Schema (MongoDB / Mongoose)

All collections have `createdAt`, `updatedAt` (Mongoose timestamps). IDs are ObjectId. References are by id; small denormalised snapshots are used where history matters (orders).

## users
`name, email (unique, lowercase), passwordHash, tokenVersion (int, bumped on role/active/password change to revoke sessions), role ('superadmin'|'admin'|'editor'|'manager'|'customer'), phone?, addresses[{label,name,phone,line1,line2,city,state,pincode,country,isDefault}], isActive, lastLoginAt`
Indexes: `{email:1}` unique; `{role:1}`.

## categories
`name, slug, parent (ref categories|null), path (e.g. "puja-kits/diwali"), level, description, image{url,alt}, order, isActive, seo{title,description,canonical,ogImage,noindex}`
Indexes: `{path:1}` unique; `{parent:1, order:1}`; `{isActive:1}`.
`path` is recomputed (with descendants) when slug/parent changes, and a redirect is written.

## products
`name, slug (unique), sku (unique), shortDescription, description (sanitised HTML), images[{url,alt,order}], category (ref), brand, price, salePrice?, stock, lowStockThreshold, status ('draft'|'active'|'archived'), isFeatured, attributes[{name,value}], variants[{sku,options{},price?,salePrice?,stock}], shipping{weightGrams,length,width,height,freeShipping}, soldCount, seo{title,description,canonical,ogImage,noindex}, schemaOverrides?`
Indexes: `{slug:1}` unique; `{sku:1}` unique; `{status:1, category:1, createdAt:-1}`; `{status:1, isFeatured:1}`; `{status:1, soldCount:-1}`; text index `{name, shortDescription, brand}`.
Rules: `salePrice < price`; price in paise (integer) to avoid float errors; if `variants` exist, stock is per-variant.

## pages
`title, slug (unique), description, sections[{id,type,enabled,data}], status ('draft'|'published'|'scheduled'), publishAt?, publishedAt?, previewToken, seo{…}`
Indexes: `{slug:1}` unique; `{status:1, publishAt:1}`.

## menus
`key ('header'|'mobile'|'footer-legal'|custom, unique), name, items[ menuItem ]` where `menuItem = {id, label, type('page'|'category'|'product'|'external'), ref?, url?, openInNewTab, enabled, showOnDesktop, showOnMobile, isDropdown, order, children:[menuItem]}` (≤3 levels).
Embedded (a menu is always read whole). Index: `{key:1}` unique.

## footer (single doc)
`columns[{id,heading,order,enabled,links[{label,url,order}]}], social[{platform,url,enabled}], contact{address,phone,email}, newsletter{enabled,heading,text}, legalLinks[{label,url}], copyright`

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
`from (unique, normalised path), to, code (301), hits`. Index `{from:1}` unique.

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
