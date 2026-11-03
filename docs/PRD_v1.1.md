# GodPuja — Product Requirements Document v1.1

> **Source document.** Owner-supplied PRD, kept verbatim as the product source of truth.
> **Stack note:** §14 lists *recommended* technologies. The owner decided (2026-11-03) to keep the current stack (Next.js + MongoDB, in-app commerce/CMS/auth). How each requirement maps onto that stack is in [PROJECT_PRD.md §16](../PROJECT_PRD.md#16-prd-v11-adoption-scope-stack-mapping-and-gaps).

A global destination for spiritual products, temples, devotional content and pooja services.

| Document detail | Value |
|---|---|
| Version | 1.1 — Updated to include temple-based pooja booking |
| Status | Initial developer specification |
| Working product name | GodPuja / GodPooja (brand decision pending) |
| Target market | Global |
| Primary platform | Responsive website; website-first |
| Mobile application | Not in initial release; architecture should remain extensible |
| Primary audiences | Devotees, spiritual shoppers, temple visitors, NRIs and service seekers |

**Product vision:** Make it simple for people anywhere in the world to shop for spiritual essentials, discover temples, book poojas at temples or other venues, access devotional content, and support verified religious organizations.

## Document control and product summary

This PRD defines the product scope, user journeys, functional requirements, administrative workflows, data model, technical architecture, quality requirements and release plan for GodPuja. It is intended for product design, engineering, QA and operational stakeholders.

### Core product pillars

| Pillar | Purpose | Initial priority |
|---|---|---|
| Spiritual Store | Sell pooja samagri, idols, diyas, malas, books, accessories and festival collections. | P0 |
| Temples & Donations | Discover temples, view verified information, explore events and make donations. | P1 |
| Pooja Vidhi | Publish step-by-step ritual guides, vrat information and devotional articles. | P0 |
| Aarti & Mantras | Browse lyrics, meanings and licensed/original audio by deity and language. | P0 |
| Book a Pooja / Pandit | Book a pooja at a temple, at home, another venue or online, subject to availability. | P1 |

P0 = required for initial launch. P1 = included in the product architecture and released when operational verification, partner onboarding and payment arrangements are ready. P2 = later enhancement.

## 1. Product vision, goals and principles

### 1.1 Vision

Build a trusted, elegant and globally accessible spiritual commerce and services platform that connects traditional religious practices with modern digital convenience.

### 1.2 Business objectives

- Generate revenue through spiritual product sales.
- Enable discovery of temples and their religious services.
- Facilitate temple-based and other pooja bookings.
- Facilitate donations to verified temples and eligible religious organizations.
- Build organic traffic through high-quality Pooja Vidhi, Aarti and Mantra content.
- Build repeat engagement through festival collections, daily essentials and relevant recommendations.
- Establish a recognizable spiritual lifestyle brand.

### 1.3 UX principles

- Core tasks should be reachable from the homepage or primary navigation without unnecessary menu depth.
- Use clear labels and consistent calls to action.
- Design mobile-first, with accessible forms, readable content and touch-friendly controls.
- Maintain an elegant, minimalist, warm visual identity; avoid excessive religious ornamentation.
- Show complete costs, booking conditions, donation recipient details and cancellation terms before confirmation.
- Do not imply temple, Pandit, product authenticity, verification or tax deductibility unless substantiated.

## 2. Target users and primary journeys

| User segment | Primary needs | Key journeys |
|---|---|---|
| Spiritual shopper | Find and purchase religious products. | Search → product → cart → checkout → tracking. |
| Devotee / learner | Learn rituals and access prayers. | Browse Pooja Vidhi/Aarti → read/listen → related content/products. |
| Temple visitor | Find a temple, timings, services and events. | Search temple → temple profile → view poojas → book a temple pooja. |
| Pooja customer | Arrange a ceremony at a temple, home or online. | Choose pooja → choose venue/mode → date/time → details → payment/request. |
| Donor | Support a verified temple or campaign. | Temple/campaign → recipient and purpose → amount → payment → receipt. |
| Admin / operations | Manage commerce, content, temples, Pandits and bookings. | Admin dashboard → manage records → monitor transactions and fulfilment. |

## 3. Information architecture and sitemap

Primary navigation should expose the five main pillars. Search, account, wishlist and cart should remain consistently accessible.

| Top-level navigation | Key pages |
|---|---|
| Shop | All products, categories, collections, product detail, cart, checkout. |
| Temples | Explore temples, country/city filters, temple detail, timings, events, available poojas, donate. |
| Pooja Vidhi | Daily pooja, festival pooja, special pooja, vrat/katha, step-by-step guides, article detail. |
| Aarti & Mantras | Browse by deity, aarti, mantras, chalisa/stotra, lyrics, meaning, audio. |
| Book a Pooja | Browse poojas, temple-based booking, home/venue booking, online pooja, booking details and confirmation. |
| My Account | Profile, orders, bookings, donations, wishlist, addresses, preferences. |
| Support | About, contact, FAQs, shipping, returns, cancellation, privacy, terms. |

### 3.1 URL examples

- `/shop/` and `/shop/pooja-samagri/`
- `/product/brass-ganesha-idol/`
- `/temples/` and `/temples/india/varanasi/example-temple/`
- `/temples/{temple-slug}/poojas/`
- `/temples/{temple-slug}/poojas/{pooja-slug}/`
- `/pooja-vidhi/ganesh-chaturthi-pooja/`
- `/aarti/ganesh-aarti/` and `/mantras/hanuman-chalisa/`
- `/book-pooja/` and `/book-pooja/{pooja-slug}/`

## 4. Homepage requirements

The homepage should introduce all pillars without overwhelming visitors. It should act as a task launcher rather than a long, complicated catalogue.

1. Hero banner with a concise value proposition and primary Shop / Explore CTA.
2. Quick-access tiles for Shop Products, Find Temples, Book a Pooja, Pooja Vidhi, Aarti & Mantras and Donate.
3. Shop by category and featured/bestselling products.
4. Festival collections and seasonal campaigns.
5. Featured temples with location and View Temple CTA.
6. Temple pooja booking promotion, linking to available temple services.
7. Featured Pooja Vidhi and devotional content.
8. Aarti / Mantra highlights with audio preview where licensed.
9. Pandit booking promotion for home, venue and online services.
10. Trust, support and policy information in the footer.

### 4.1 Homepage acceptance

- Every primary pillar is reachable within one click from a clearly visible homepage entry point.
- Search is available in the global header.
- Homepage modules can be reordered, enabled or disabled by authorized admins.
- Promotional content links to a valid destination and is manageable through CMS.

## 5. Spiritual Store — e-commerce

### 5.1 Product taxonomy

| Category | Examples |
|---|---|
| Pooja Samagri | Haldi, kumkum, chandan, camphor, havan samagri. |
| God Idols & Murtis | Ganesha, Shiva, Krishna, Hanuman, Lakshmi, Durga. |
| Diyas & Lamps | Brass diya, akhand diya, oil lamps. |
| Incense & Dhoop | Agarbatti, dhoop sticks, cones. |
| Rudraksha & Malas | Rudraksha, jap mala, tulsi mala. |
| Spiritual Accessories | Yantras, bells, shankh. |
| Pooja Accessories | Thali, kalash, aasan, mandir accessories. |
| Religious Books | Bhagavad Gita, chalisa, scriptures. |
| Festival Collections | Diwali, Navratri, Janmashtami, Ganesh Chaturthi. |
| Spiritual Gifts | Gift sets and religious hampers. |

### 5.2 Product listing

- Display image, name, selling price, original price/discount when applicable, rating, wishlist and availability.
- Support filters for category, price, deity, material, size, availability, rating and occasion.
- Support sorting by featured, bestseller, newest, price ascending/descending and rating.
- Provide quick add-to-cart where variants do not require selection.

### 5.3 Product detail

- Image gallery and zoom; title, SKU, price, discount and variants.
- Dynamic attributes such as dimensions, weight, material, fragrance, quantity and burn duration as applicable to each product.
- Stock status, quantity, add to cart, buy now, delivery estimate and destination availability.
- Description, specifications, reviews, related products and recently viewed products.
- Product data must not assume every SKU has identical attributes.

### 5.4 Cart, checkout and order management

1. Cart supports add/remove, quantity updates, coupon validation, subtotal, shipping, taxes and total.
2. Guest checkout is supported; registered users can save carts and addresses.
3. Checkout captures contact details, destination address, shipping option, payment and order review.
4. Show transaction currency and all known charges before payment authorization.
5. Handle successful, failed, pending and interrupted payment states without creating false paid orders.
6. Customer account displays order status, shipment tracking, invoice, cancellation and return/refund request where policy allows.
7. Admin can process orders, update fulfilment, add tracking, process refunds and export reports.

Suggested order statuses: Pending Payment, Confirmed, Processing, Shipped, Delivered, Cancelled, Payment Failed, Return Requested, Returned and Refunded.

## 6. Temples, temple information and temple-based pooja booking

This module is expanded to support both temple discovery and direct booking of poojas offered by a temple. A visitor must be able to open a temple profile, see which poojas are available at that temple, select a service and request or confirm a booking for a date/time subject to the temple's published availability and approval rules.

### 6.1 Temple discovery

- Search by temple name, deity, country, region/state, city and temple type.
- Browse featured, popular and recently added temples.
- Show location, map/directions, contact details and official website where available.
- Filters should only expose attributes supported by the temple data.

### 6.2 Temple profile

| Field | Requirement |
|---|---|
| Identity | Official temple name, slug, images, short and long description. |
| Location | Country, region, city, full address, map coordinates and directions link. |
| Religious information | Main deity, history, significance and traditions, reviewed before publishing. |
| Visitor information | Opening hours, special schedules, visitor guidance and accessibility information where supplied. |
| Contact | Official phone, email and website, where verified. |
| Events | Upcoming festivals, ceremonies and event dates. |
| Pooja services | List of poojas offered at this temple, details, eligibility/requirements, price or quote model, duration and availability. |
| Donations | Verified recipient, donation purpose, payment destination and receipt details. |

### 6.3 Temple pooja catalogue

Each temple can maintain its own service catalogue. A pooja offered at one temple may have different prices, duration, inclusions, booking rules or available dates at another temple. Do not treat a generic pooja service as universally bookable at every temple.

- Temple admin or authorized GodPuja operations staff can create and manage temple-specific pooja offerings.
- Each offering includes name, description, deity/tradition, image, duration, language, inclusions, required devotee information, price or quote basis, capacity, booking lead time, cancellation policy and active status.
- Support fixed-price, variable-price, donation-based (only where legally and operationally appropriate) and request-a-quote offerings.
- Allow the temple to define whether bookings are instantly confirmed or require temple approval.
- Allow temple-specific blackout dates, special festival schedules, daily slots and capacity per slot.

### 6.4 Temple pooja booking journey

1. Visitor searches for a temple or browses a temple profile.
2. Visitor selects View Poojas / Book a Pooja on the temple profile.
3. Visitor reviews the list of poojas offered by that specific temple.
4. Visitor opens a pooja detail page and reviews purpose, inclusions, duration, requirements, price and cancellation terms.
5. Visitor selects a date and available time/slot. Availability is shown in the temple's local timezone, with the timezone clearly labelled.
6. Visitor enters required devotee details and special instructions. Collect only information needed by that ritual.
7. Visitor reviews booking summary, total amount, fees, taxes and payment/refund terms.
8. Visitor pays in full, pays a deposit or submits a request depending on the temple's configured booking model.
9. System confirms instantly or displays Pending Temple Confirmation.
10. Customer receives confirmation, booking reference, temple address/directions, arrival instructions and contact information.
11. Temple/admin can view the booking, confirm/reject, update status and communicate operational changes.
12. After the scheduled service, booking can be marked completed and eligible customer feedback can be requested.

### 6.5 Booking modes across the platform

| Mode | Description | Required information |
|---|---|---|
| At a temple | Customer books a pooja at a selected temple location. | Temple, temple-specific service, date/slot, devotee details, attendee count if relevant. |
| At home / chosen venue | Customer requests a Pandit to attend a specified address. | Service, full venue address, date/slot, travel/service area, devotee details. |
| Online / live | Customer books a remote pooja or consultation/service where offered. | Service, date/slot, timezone, contact details, online meeting/delivery instructions. |

### 6.6 Temple booking statuses

Use explicit states so customers and temple operators understand whether a booking is merely requested or actually confirmed.

| Status | Meaning |
|---|---|
| Draft | Booking not submitted. |
| Pending Payment | Payment action is required. |
| Pending Temple Confirmation | Request received; temple has not accepted yet. |
| Confirmed | Temple has accepted and slot is reserved. |
| Rejected | Temple cannot fulfil the request; payment handling follows policy. |
| Reschedule Requested | Customer or temple requested a schedule change. |
| Cancelled | Booking cancelled under applicable rules. |
| Refund Pending / Refunded | Refund processing state. |
| Completed | Pooja/service marked complete. |
| No-show / Disputed | Operational exception requiring admin review. |

### 6.7 Temple operator portal / admin workflow

- Create and update temple profile, subject to GodPuja verification and publication approval.
- Manage temple-specific pooja catalogue, descriptions, pricing and service terms.
- Configure opening hours, pooja slots, blackout dates, festival exceptions and slot capacity.
- Receive booking notifications and view booking calendar.
- Accept, reject or propose rescheduling for pending requests.
- View customer-provided ritual details only for bookings they are authorized to fulfil.
- Update booking status and provide instructions to the customer.
- View payment, settlement and refund status according to the agreed payment model.
- Maintain audit trail for booking, schedule and payment-related changes.

### 6.8 Temple verification and operational controls

- A temple profile and its booking capability must not become publicly active until the temple/authorized representative and contact/payment details are reviewed.
- Record verification status, evidence references, reviewer, review date and next review date.
- Clearly distinguish GodPuja-verified information from information supplied but not independently verified.
- Do not accept payments on behalf of a temple unless the legal recipient, merchant/marketplace arrangement, settlement flow and refund responsibility have been approved.
- Define who is responsible for service delivery, customer support, cancellation and dispute resolution before enabling bookings.

## 7. Donations

Donations are separate from product checkout and pooja booking payments. Each donation must be associated with a clearly identified legal recipient and purpose.

1. Visitor opens a temple or campaign page.
2. System displays recipient's legal name, campaign purpose, payment destination and any platform fee.
3. Donor selects a preset or custom amount and currency.
4. Donor enters required details and any optional dedication/message.
5. Payment is processed through an approved payment arrangement.
6. System records transaction reference, recipient, gross amount, fees, net settlement and status.
7. Receipt/confirmation is issued by the legally appropriate recipient or payment arrangement.

- Do not imply tax deductibility unless legally confirmed for the recipient and donor jurisdiction.
- Do not pool or hold charitable funds without approved legal and payment structure.
- Provide reconciliation and refund/chargeback handling.
- Donation receipts must not be represented as product invoices or pooja service invoices.

## 8. Pooja Vidhi content module

- Categories include daily pooja, festival pooja, special pooja, vrat/katha and step-by-step guides.
- Article detail includes title, introduction, significance, samagri list, preparation, steps, mantras, related aarti, related products and related content.
- Admin can draft, edit, preview, schedule, publish, unpublish and assign authors/reviewers.
- Support SEO title, meta description, canonical URL, image alt text, tags and internal links.
- Religious content should be reviewed for accuracy, tradition and cultural sensitivity.

Commerce integration: a Ganesh Chaturthi guide may link contextually to a Ganesh idol, pooja thali, diya, incense and other relevant essentials. Links should assist the reader rather than interrupt the guide.

## 9. Aarti and Mantra module

- Browse by deity, title, language, content type and search terms.
- Aarti detail includes title, deity, lyrics, meaning, language, related content and audio where available.
- Audio player supports play/pause, seek, progress, volume and playback speed.
- Favourites and sharing may be included in the initial release if schedule permits.
- Use original, licensed or public-domain recordings. Traditional lyrics do not make a modern recording automatically copyright-free.
- Store media rights/permission metadata and remove content when rights expire or are withdrawn.

## 10. Book a Pandit — home, venue and online services

This module supports ceremonies outside a temple as well as online pooja services. Temple-based bookings are handled by the temple-specific service catalogue in Section 6; both booking types should use a shared booking foundation where practical.

### 10.1 Service categories

- Griha Pravesh
- Satyanarayan Pooja
- Ganesh Pooja
- Rudrabhishek
- Marriage Pooja
- Vastu Shanti
- Navgraha Shanti
- Havan
- Birthday/anniversary pooja
- Custom ceremony

### 10.2 Pandit profile and verification

- Profile photo, name, introduction and verified experience/credentials where available.
- Languages, traditions/specializations, service categories and geographic coverage.
- Availability, ratings/reviews and verification status.
- Admin approval required before a profile is publicly bookable.

### 10.3 Recommended initial workflow

Start with request-and-confirm rather than complex automated marketplace matching. Customer submits a request; operations checks provider availability, assigns a verified Pandit, confirms the booking and collects payment according to the service policy. Add self-service provider scheduling and automated matching after demand and operations are validated.

## 11. Customer accounts

- Email/password and supported OAuth sign-in; email verification and password reset.
- Guest checkout for store purchases.
- Dashboard for orders, temple pooja bookings, home/online bookings, donations, wishlist and saved addresses.
- Profile includes name, email, phone, country, preferred language, currency and timezone.
- Collect gotra, birth details or other ritual-specific personal information only when necessary for a selected service and with appropriate notice.

## 12. Admin and temple operator capabilities

| Role | Permissions |
|---|---|
| Super Admin | Full platform configuration and access control. |
| Store Manager | Products, categories, inventory, orders and fulfilment. |
| Content Manager | Pooja Vidhi, Aarti, Mantra, media and SEO. |
| Temple Operations Manager | Temple verification, temple profiles, temple services and temple bookings. |
| Temple Operator | Only assigned temple profile, service slots and bookings, within granted permissions. |
| Pandit / Provider Manager | Pandit onboarding, verification, service coverage and assignments. |
| Booking Manager | Bookings, scheduling, customer communication and refunds subject to permissions. |
| Support Agent | Customer support and limited order/booking visibility. |

Role-based access control is mandatory. Temple operators must only access their own temple's data and bookings. Sensitive actions must be logged with actor, timestamp, action and relevant record.

## 13. Global commerce and localization

- Support country selection and currency display; maintain an authoritative base currency for accounting.
- Show transaction currency and final payable amount before payment.
- Store money as decimal/minor-unit amounts with ISO currency codes; do not use floating-point arithmetic for financial calculations.
- Support destination-dependent shipping, tax and product restrictions.
- Support UTC storage and local-time rendering; temple booking slots must use the temple's timezone.
- Launch English first and plan Hindi localization; architecture should support additional scripts/languages.
- Use locale-aware number/date formatting and translated content fields.
- Do not promise global shipping or service coverage where unavailable.

## 14. Technical architecture and recommended stack

Recommended architecture: responsive Next.js frontend, API/application layer, one authoritative commerce engine, PostgreSQL for platform-specific records, a CMS for editorial content, and integrated payment, shipping, search and notification services.

| Layer | Recommended options / notes |
|---|---|
| Frontend | Next.js, React, TypeScript. |
| UI | Tailwind CSS and a consistent accessible component system such as shadcn/ui. |
| Commerce | Shopify for faster managed commerce, or Medusa.js for greater backend customization. |
| Database | PostgreSQL for temple, booking, provider, content relationships and platform records. |
| Authentication | Auth.js or Supabase Auth; secure OAuth and session management. |
| CMS | Sanity or Payload CMS for Pooja Vidhi, Aarti, Mantra and editorial content. |
| Storage | S3-compatible object storage or Cloudinary. |
| Search | Meilisearch or Algolia; support product, temple and content indexes. |
| Payments | Stripe and region-specific providers subject to merchant eligibility and market. |
| Maps | Google Maps or equivalent mapping/geocoding provider. |
| Email | Resend, Amazon SES or equivalent transactional email provider. |
| Hosting | Managed frontend hosting plus managed database/backend infrastructure. |

Architecture decision: choose one authoritative commerce system for products, inventory, cart, checkout and orders. Do not maintain competing commerce databases. Build temple, donation and booking modules as separate bounded domains connected through stable APIs and shared identity.

### 14.1 Payment design

- Separate product payments, pooja service payments and donations in transaction records and reporting.
- Support full payment, deposit or pay-later/request-confirmation rules per service offering.
- Use payment provider hosted/tokenized flows; never store raw card data.
- Verify webhook signatures and make webhook processing idempotent.
- Record gross amount, currency, fee, tax, net settlement, provider reference and refund state.
- For temple and Pandit marketplace flows, define merchant of record, connected account, settlement, chargeback and refund responsibility before implementation.

## 15. Initial database entities and relationships

| Entity | Key data / purpose |
|---|---|
| Users | Identity, contact details, role, preferences. |
| Addresses | User, address, country, postal code. |
| Products / Variants | SKU, title, slug, price, currency, attributes, inventory reference. |
| Categories / Images | Taxonomy and product media. |
| Carts / Cart Items | Customer or guest cart and selected variants. |
| Orders / Order Items | Order totals, currency, item snapshots and status. |
| Payments / Refunds | Provider references, amount, fees, settlement and status. |
| Shipments | Carrier, tracking, delivery status. |
| Reviews / Wishlist | Verified reviews and saved products. |
| Temples | Identity, location, timezone, contact, verification and public content. |
| Temple Schedules | Opening hours, exceptions, festival schedules and timezone. |
| Temple Services | Temple-specific pooja offering, pricing model, duration, terms and active status. |
| Temple Service Slots | Date/time, capacity, availability, blackout and reservation state. |
| Pandits / Provider Services | Profile, verification, languages, service coverage and specializations. |
| Provider Availability | Availability windows and blocked times. |
| Bookings | Customer, booking type, temple/service/provider, schedule, status and payment reference. |
| Booking Details | Devotee/ritual information, attendee count, venue and special instructions. |
| Donation Recipients / Campaigns | Legal recipient, verification, purpose and payment arrangement. |
| Donations | Donor, recipient, campaign, amount, currency, fee, receipt and status. |
| Articles / Aarti / Mantras | Localized content, media, rights metadata and SEO fields. |
| Notifications | Recipient, channel, template, delivery state. |
| Audit Logs | Actor, action, record, timestamp and before/after metadata where appropriate. |

### 15.1 Data integrity rules

- Use stable primary keys, foreign keys and indexes.
- Use unique slugs for public content and product URLs.
- Store all timestamps in UTC; retain IANA timezone identifiers for temples and service locations.
- Persist booking slot reservations transactionally to prevent double booking.
- Use idempotency keys for payment and booking creation endpoints.
- Keep financial transaction records immutable; record adjustments/refunds separately.
- Separate public temple data from private customer booking data.
- Enforce tenant/temple-level authorization for temple operator accounts.

## 16. Integrations

| Integration | Purpose | Priority |
|---|---|---|
| Stripe | International card/payment processing where merchant is eligible. | P0 |
| Regional gateway | Local payment methods such as UPI where supported. | P1 |
| Maps/geocoding | Temple location, directions and service area validation. | P1 |
| OAuth | Supported sign-in providers. | P0 |
| Email service | Order, booking, donation and account notifications. | P0 |
| Shipping provider | Rates, labels and tracking. | P0 |
| GA4 / Search Console | Analytics and SEO monitoring. | P0 |
| SMS / WhatsApp | Booking and delivery alerts, subject to consent/provider approval. | P2 |
| Calendar integration | Optional provider/temple calendar synchronization. | P2 |

## 17. UI/UX design system

### 17.1 Visual direction

Elegant, minimalist, premium, warm and welcoming. Use real product photography, generous whitespace, clear typography and restrained spiritual motifs.

| Token | Suggested value |
|---|---|
| Ivory | #F7F3EA |
| Sand | #D6C3A1 |
| Muted gold | #B38A4A |
| Terracotta | #8D593B |
| Charcoal | #292820 |
| Heading typeface | Cormorant Garamond or Playfair Display (validate script support). |
| Body typeface | Inter or DM Sans. |
| Devanagari | Noto Sans Devanagari. |

### 17.2 Interaction requirements

- Responsive desktop, tablet and mobile layouts.
- Collapsible mobile navigation and persistent search access.
- Sticky add-to-cart on mobile product pages where useful.
- Readable article typography and accessible audio controls.
- Clear form labels, validation, help text and error recovery.
- Visible loading, empty, success and error states.
- Keyboard navigation, semantic HTML and sufficient contrast.
- Avoid intrusive popups and unnecessary animation.

## 18. SEO and content discovery

- Unique title and meta description for indexable pages.
- Canonical URLs, XML sitemap, robots.txt and breadcrumb navigation.
- Open Graph metadata and descriptive image alt text.
- Structured data where accurate: Product, ProductGroup, BreadcrumbList, Article, Organization, WebSite and eligible Event/LocalBusiness types.
- Localized URLs and hreflang when translated pages are available.
- Server-rendered/indexable content for public product, temple and editorial pages.
- Contextual internal links between Pooja Vidhi, Aarti, temple services and relevant products.
- Do not add review/rating or organization schema that is not supported by visible, verified page data.

## 19. Security, privacy and performance

### 19.1 Security

- HTTPS everywhere, secure password hashing and session handling.
- Role-based authorization and least-privilege access.
- Input validation, rate limiting and protection against common web vulnerabilities.
- Payment webhook signature validation and idempotent processing.
- Encrypted secrets, secure backups and tested recovery.
- Admin and financial/booking audit logs.
- No raw payment card storage.

### 19.2 Privacy

- Comply with applicable privacy requirements, including GDPR/UK GDPR, Canadian privacy laws and other relevant jurisdictions.
- Publish privacy, cookie, retention and deletion policies.
- Provide access/correction/deletion workflows where required.
- Collect only ritual-specific personal data needed for a requested service.
- Restrict access to sensitive devotee information and define retention/deletion periods.
- Do not use devotional activity for unnecessary profiling or disclose it to advertising partners without an appropriate lawful basis.

### 19.3 Performance targets

| Metric | Target |
|---|---|
| Lighthouse Performance | 85+ mobile target |
| Accessibility | 90+ |
| SEO | 95+ |
| Largest Contentful Paint | ≤ 2.5 seconds |
| Interaction to Next Paint | ≤ 200 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| Availability | 99.9% target |

## 20. Development roadmap

| Phase | Scope | Indicative duration |
|---|---|---|
| Phase 1 — Foundation | Brand/UI, homepage, store, catalogue, cart, checkout, customer accounts, order admin, Pooja Vidhi CMS, Aarti/Mantra CMS, SEO/analytics. | 6–8 weeks |
| Phase 2 — Temples and services | Temple directory/profile, temple-specific pooja catalogue, temple slot management, temple booking workflow, verified donations, Pandit profiles and home/online booking. | 4–7 weeks |
| Phase 3 — Global and advanced | Expanded languages/currencies, broader shipping/payment coverage, automated availability, online pooja enhancements, advanced search, playlists and personalization. | 6–10 weeks |

These are preliminary planning estimates, not delivery commitments. Parallel work is possible. Final estimates require approved designs, integration choices, partner readiness, content inventory and engineering capacity.

## 21. Acceptance criteria and QA

| Area | Acceptance criteria |
|---|---|
| Homepage | All five pillars accessible from homepage or primary navigation. |
| Store | Search, filter, view product, select variant and add to cart. |
| Checkout | Correct shipping/tax/total; clear currency; safe failed-payment handling. |
| Orders | Customer and admin see consistent order state and tracking. |
| Temple discovery | Search and open verified temple profiles with accurate location/timezone. |
| Temple pooja booking | View temple-specific services, select available slot, submit request/pay, prevent double booking and receive accurate confirmation state. |
| Temple operations | Authorized operator manages only assigned temple services, schedules and bookings. |
| Donations | Recipient and purpose displayed; transaction traceable; correct receipt responsibility. |
| Pooja Vidhi | Admin creates, previews, publishes and links relevant content/products. |
| Aarti | Browse lyrics and play only available authorized audio. |
| Pandit booking | Request, assign, confirm, reschedule/cancel and close booking. |
| Global | Country, currency, locale and timezone behave correctly. |
| Security | Unauthorized access is denied and sensitive actions are audited. |

### 21.1 Critical end-to-end test scenarios

1. Guest completes a product purchase and receives confirmation.
2. Registered customer purchases multiple products and views order history.
3. Coupon, tax, shipping and payment failure scenarios are handled correctly.
4. Customer reads a Pooja Vidhi and opens related products.
5. Visitor finds a temple, views its local timezone and checks its pooja offerings.
6. Customer books a temple pooja for an available slot and receives the correct pending/confirmed status.
7. Two customers attempt to reserve the last available temple slot; only one reservation succeeds.
8. Temple operator changes availability; existing confirmed bookings are not silently overwritten.
9. Temple rejects a pending booking; customer receives notification and payment/refund treatment follows policy.
10. Customer requests a home/online Pandit booking and admin assigns a provider.
11. Visitor makes a donation to a verified recipient and receives the correct confirmation.
12. Customer changes destination country/currency and sees accurate checkout disclosures.
13. Unauthorized temple operator cannot view another temple's customer or booking records.

## 22. Business assumptions, dependencies and risks

| Area | Initial assumption / dependency |
|---|---|
| Brand | GodPuja is a working name; final brand decision pending. |
| Store model | Single-store operator at launch; not an open seller marketplace. |
| Fulfilment | GodPuja-managed or approved supplier fulfilment. |
| Temple profiles | Admin-verified before being labelled verified. |
| Temple bookings | Only temples with confirmed service/slot operations can accept bookings. |
| Donations | Authorized recipient and payment/settlement structure required. |
| Pandit onboarding | Manual verification and assignment initially. |
| Payment model | Full payment, deposit or request-first configured per service. |
| Languages | English first; Hindi next. |
| Mobile app | Not in initial release. |

- Global shipping, import restrictions and product eligibility vary by country.
- Payment provider eligibility and settlement models vary by merchant country and service type.
- Temple and donation recipient verification requires operational processes.
- Temple slot availability must be kept current to avoid double booking and customer disputes.
- Religious content and audio require accuracy and rights management.
- Service cancellation, no-show, refund and dispute rules must be agreed before launch.
- Multi-currency accounting and cross-border settlement require professional review.

## 23. Decisions required before development

| Decision | Recommended starting point |
|---|---|
| Brand spelling | Keep GodPuja as working name; validate GodPooja before brand lock. |
| Store model | Single-store operator. |
| Product sourcing | GodPuja-managed catalogue / selected suppliers. |
| Temple participation | Verified temples with authorized operator accounts. |
| Temple pooja booking | Temple-specific services and availability; instant confirmation only where reliable, otherwise approval workflow. |
| Donation flow | Direct/authorized recipient payment arrangement. |
| Pandit model | Admin-managed provider network initially. |
| Geographic launch | Global architecture, but activate only countries where shipping, payment and service operations are ready. |
| Languages | English first, Hindi next. |
| Mobile app | Future phase. |

## 24. Roles and delivery handoff

| Workstream | Owner |
|---|---|
| Product scope, priorities and acceptance | Product Manager |
| Brand identity, design system and responsive screens | UI/UX Designer |
| Technical architecture and integrations | Technical Lead |
| Commerce, APIs, data model and booking logic | Backend Developer |
| Responsive storefront and customer portal | Frontend Developer |
| CMS and admin/temple operator portal | Full-stack Developer |
| SEO and content migration | SEO / Content Specialist |
| Functional, security and cross-device testing | QA Engineer |
| Temple/Pandit verification, fulfilment and support procedures | Business Operations |

## 25. Final product definition

GodPuja is a global spiritual commerce and services platform with five connected pillars: Shop, Temples & Donations, Pooja Vidhi, Aarti & Mantras, and Book a Pooja. A key differentiator is that users can book a pooja at a participating temple as well as request a Pandit for a home, other venue or online service.

The experience should remain elegant and minimalist, with direct access to core tasks, trustworthy information, transparent pricing and clear booking/payment states.

### Recommended immediate next deliverables

1. Approve the sitemap and P0/P1 scope.
2. Confirm the commerce engine and payment/settlement model.
3. Create desktop and mobile wireframes for homepage, store, temple profile, temple pooja booking, donation, devotional content, Pandit booking and customer account.
4. Create the admin and temple operator workflows, including service availability and booking calendar.
5. Validate legal/payment arrangements for donations and temple service bookings.
6. Produce a sprint plan and engineering estimates against the approved designs.
