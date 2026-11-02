# Project: Customizable E-commerce CMS with Next.js & MongoDB

Act as a senior product architect, Next.js engineer, UI/UX designer, and backend performance engineer. I want to build a modern, lightweight, fully customizable **CMS + E-commerce platform** using Next.js and MongoDB.

The product should allow administrators to manage website content, pages, navigation, categories, products, SEO, orders, and the overall storefront from a centralized admin dashboard.

**Important:** Do not over-engineer the product. Prioritize simplicity, maintainability, performance, scalability, and excellent UI/UX.

# 1. First Task: Create a Complete Stage-Wise PRD

Before writing implementation code, thoroughly inspect the existing codebase and create a comprehensive implementation document:

`PROJECT_PRD.md`

The document must include:

- Product vision and objectives.
- Complete functional requirements.
- Admin and customer workflows.
- System architecture.
- Database schema and relationships.
- API architecture and endpoint definitions.
- Frontend route structure.
- Admin dashboard modules.
- Storefront modules.
- Authentication and authorization.
- SEO architecture.
- Performance strategy.
- Security requirements.
- Error handling and validation.
- Testing strategy.
- Stage-wise implementation plan.
- Completion and audit tracking.

Do not start implementation until the PRD and stage-wise plan are documented.

# 2. Technology Stack

Use a modern, lightweight Next.js architecture.

- Next.js (App Router).
- TypeScript.
- MongoDB with Mongoose.
- Tailwind CSS.
- Centralized design tokens using CSS variables.
- shadcn/ui where useful.
- React Hook Form + Zod for forms and validation.
- Axios or native fetch with a centralized API service.
- Proper authentication and role-based access control.
- Image optimization and efficient media storage.
- Lightweight libraries only when genuinely required.

Avoid unnecessary dependencies, duplicate abstractions, excessive components, and complicated architectural patterns.

# 3. Centralized Design System

Create a centralized design system before implementing pages.

Create and maintain:

- Global CSS variables.
- Tailwind theme configuration.
- Primary and secondary colors.
- Typography scale.
- Font weights.
- Spacing system.
- Border radius.
- Shadows.
- Container widths.
- Button variants.
- Input styles.
- Table styles.
- Responsive breakpoints.

**Mandatory design rules:**

1. Every page must use centralized design tokens.
2. Never hardcode random colors, spacing, or typography.
3. Keep the UI clean, premium, modern, and professional.
4. Avoid unnecessary shadows, gradients, and excessive rounded cards.
5. Maintain consistent layouts across admin and storefront.
6. Support responsive desktop, tablet, and mobile layouts.
7. Maintain proper accessibility and WCAG contrast.
8. Use consistent reusable components.

Document these rules in `DESIGN_SYSTEM.md`.

Claude must always read `DESIGN_SYSTEM.md` before creating or modifying UI components. Never introduce new design values without updating the centralized design system.

# 4. CMS Architecture

Build a flexible CMS that allows administrators to manage the complete website without modifying code.

## A. Dynamic Navbar Management

Create a customizable navbar management module.

Administrators should be able to:

- Create multiple navigation menus.
- Add, edit, and delete menu items.
- Create parent categories and nested subcategories.
- Support multiple nesting levels where practical.
- Reorder items using drag and drop.
- Add internal page links.
- Add product category links.
- Add external URLs.
- Enable or disable individual menu items.
- Configure dropdown menus.
- Configure desktop and mobile navigation separately.
- Control visibility and ordering.

The storefront navbar must automatically reflect CMS changes.

## B. Dynamic Footer Management

Create a customizable footer management module.

Allow administrators to:

- Create multiple footer columns.
- Add headings and links.
- Add social media links.
- Add contact information.
- Add copyright information.
- Configure legal links.
- Add newsletter sections.
- Control visibility and ordering.

Footer changes should automatically reflect on the storefront.

## C. Dynamic Page Builder

Build a CMS page management system.

Administrators should be able to:

- Create unlimited pages.
- Edit and delete pages.
- Define page title and URL slug.
- Assign a category and subcategory.
- Add page descriptions and content.
- Configure page sections.
- Reorder content sections.
- Publish, unpublish, or schedule pages.
- Preview pages before publishing.
- Manage SEO metadata.
- Configure canonical URLs.
- Add Open Graph metadata.

Each page should have a clean, SEO-friendly URL.

Support reusable page sections instead of building an unnecessarily complicated visual page builder.

# 5. E-commerce Product Management

Build a complete product management module.

## Product Master

Allow administrators to create and manage products with:

- Product name.
- SEO-friendly slug.
- SKU.
- Short description.
- Full description.
- Product images and gallery.
- Category and subcategory.
- Brand.
- Regular price.
- Sale price.
- Stock quantity.
- Product status.
- Featured product flag.
- Product attributes.
- Variants where required.
- Shipping information.
- Product SEO title.
- Meta description.
- Canonical URL.
- Open Graph image.
- Product schema data.

## Product Categories

- Create unlimited categories.
- Create nested subcategories.
- Assign products to categories.
- Manage category descriptions.
- Manage category SEO metadata.
- Configure category images.
- Generate SEO-friendly category URLs.

## Storefront Product Display

Products should automatically appear in the appropriate storefront sections.

Support:

- Featured products.
- Latest products.
- Best-selling products.
- Category-based products.
- Related products.
- Product detail pages.
- Product search.
- Filtering and sorting.

# 6. Homepage: CMS Content + E-commerce

The homepage must combine dynamic CMS content and products.

Administrators should be able to manage homepage sections, including:

- Hero section.
- Promotional banners.
- Featured categories.
- Featured products.
- Latest products.
- Best sellers.
- Marketing content.
- Text and image sections.
- Testimonials.
- Promotional offers.
- Custom content blocks.

Allow administrators to enable, disable, reorder, and edit homepage sections.

Do not hardcode homepage content.

Build a clean, visually attractive storefront with a professional e-commerce experience.

# 7. Order Management

Create a complete order management module.

Administrators should be able to:

- View all orders.
- Search and filter orders.
- View complete order details.
- View customer information.
- View purchased products.
- View quantities and pricing.
- View payment status.
- View shipping details.
- Update order status.
- Update payment status where authorized.
- Add internal order notes.
- Manage cancellations and refunds.
- View order history.
- Export order data.

Implement a reliable order lifecycle with clearly defined status transitions.

Ensure stock updates and order creation are consistent. Prevent duplicate orders, duplicate payment processing, and inventory race conditions.

# 8. SEO Architecture

SEO must be integrated into CMS and product management from the beginning.

Implement:

- SEO-friendly URL slugs.
- Dynamic metadata.
- Unique page titles.
- Meta descriptions.
- Canonical URLs.
- Open Graph tags.
- Twitter metadata.
- XML sitemap.
- Robots.txt.
- Breadcrumb structured data.
- Product structured data.
- Organization structured data.
- Category metadata.
- Automatic internal linking where appropriate.
- Proper 301 redirects when published URLs change.

Ensure storefront pages are crawlable and use appropriate server-side rendering or static generation.

Avoid duplicate content and URL cannibalization.

# 9. API Performance: Extremely Important

API response times should be as fast as practically achievable.

Follow these principles:

- Design efficient MongoDB schemas and indexes.
- Avoid unnecessary database queries.
- Avoid N+1 query patterns.
- Use projections to fetch only required fields.
- Use pagination for large datasets.
- Avoid loading entire collections.
- Use aggregation only when beneficial.
- Use lean queries where appropriate.
- Implement caching for suitable public CMS data.
- Optimize product listing and search endpoints.
- Avoid unnecessary sequential API calls.
- Use database connection pooling correctly.
- Avoid expensive middleware and repeated computations.
- Prevent memory leaks and unbounded queries.
- Use transactions where consistency requires them.
- Implement rate limiting and request validation.

Establish API performance benchmarks and measure actual response times.

Do not sacrifice data consistency or security to achieve faster responses.

# 10. Admin Dashboard

Create a professional admin dashboard with these modules:

1. Dashboard overview.
2. CMS pages.
3. Navigation management.
4. Footer management.
5. Homepage builder.
6. Categories and subcategories.
7. Product master.
8. Product inventory.
9. Orders.
10. Customers.
11. SEO management.
12. Media library.
13. Website settings.
14. User roles and permissions.

Use a consistent sidebar, header, breadcrumbs, tables, forms, filters, and reusable components.

Keep the admin experience simple and easy to understand.

# 11. Stage-Wise Implementation Plan

Divide the project into independently implementable stages.

Suggested stages:

**Stage 0:** Existing codebase audit, requirements, architecture, and PRD.

**Stage 1:** Project setup, database connection, authentication, and centralized design system.

**Stage 2:** Admin dashboard layout, routing, reusable UI components, and permissions.

**Stage 3:** CMS page management and dynamic page rendering.

**Stage 4:** Dynamic navbar and nested category/subcategory navigation.

**Stage 5:** Footer management and dynamic footer rendering.

**Stage 6:** Product master, categories, images, and inventory.

**Stage 7:** Homepage content and product section builder.

**Stage 8:** Customer-facing storefront and product detail pages.

**Stage 9:** Cart, checkout, and order management.

**Stage 10:** Complete SEO implementation.

**Stage 11:** Performance optimization, security, and accessibility.

**Stage 12:** End-to-end testing, bug fixing, final audit, and production readiness.

You may adjust the stages based on technical dependencies, but document the reason for any changes.

# 12. Mandatory Progress Tracker

Create a `PROJECT_TRACKER.md` file.

Track every stage and its individual tasks using checkboxes.

For each task, maintain these statuses:

- NOT_STARTED
- IN_PROGRESS
- IMPLEMENTATION_COMPLETE
- AUDIT_IN_PROGRESS
- AUDIT_COMPLETE
- BLOCKED

Example:

| Stage | Task | Implementation | Audit | Status |
|---|---|---|---|---|
| 1 | Database setup | Complete | Complete | AUDIT_COMPLETE |
| 1 | Authentication | Complete | In Progress | AUDIT_IN_PROGRESS |
| 2 | Admin layout | In Progress | Pending | IN_PROGRESS |

**Mandatory workflow:**

1. Read `PROJECT_PRD.md`, `DESIGN_SYSTEM.md`, and `PROJECT_TRACKER.md` before starting each stage.
2. Implement only the tasks belonging to the current stage.
3. Test the implementation.
4. Perform an independent code audit.
5. Fix identified issues.
6. Re-run relevant tests.
7. Mark implementation complete only after implementation works.
8. Mark audit complete only after verification passes.
9. Update `PROJECT_TRACKER.md`.
10. Move to the next stage only after the current stage is implementation-complete and audit-complete.

Never mark a task complete just because code has been written.

# 13. Mandatory Audit Checklist

After every stage, perform a dedicated audit covering:

**Code quality**
- Incorrect implementation.
- Duplicate code.
- Unnecessary abstractions.
- TypeScript errors.
- Missing validation.
- Silent failures.
- Incorrect error handling.

**Backend and APIs**
- Slow database queries.
- Missing MongoDB indexes.
- Duplicate API requests.
- Incorrect API responses.
- Authentication and authorization issues.
- Race conditions.
- Transaction consistency.
- Data integrity.
- Security vulnerabilities.

**Frontend**
- Broken layouts.
- Responsive issues.
- Incorrect loading states.
- Missing empty states.
- Form validation issues.
- Hydration errors.
- Unnecessary re-renders.
- Console errors.
- Accessibility problems.

**E-commerce**
- Incorrect pricing calculations.
- Stock inconsistencies.
- Duplicate orders.
- Checkout failures.
- Invalid order status transitions.
- Payment consistency.

**SEO**
- Missing metadata.
- Duplicate titles.
- Incorrect canonical URLs.
- Broken internal links.
- Invalid structured data.
- Indexing issues.

Create an audit report after every stage:

`/docs/audits/STAGE_XX_AUDIT.md`

Document:
- Issues identified.
- Severity.
- Root cause.
- Fix implemented.
- Tests performed.
- Remaining issues.
- Final audit status.

# 14. Important Development Rules

- Do not implement the entire project in one go.
- Do not over-engineer.
- Do not introduce unnecessary dependencies.
- Do not duplicate existing functionality.
- Do not break working features.
- Do not use hardcoded CMS content.
- Do not hardcode design values outside centralized tokens.
- Do not ignore TypeScript or runtime errors.
- Do not hide API failures.
- Do not mark audits complete without actual verification.
- Keep all important architectural decisions documented.
- Use clean, reusable, maintainable code.

# 15. Final Expected Deliverables

Before implementation:
- `PROJECT_PRD.md`
- `DESIGN_SYSTEM.md`
- `PROJECT_TRACKER.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/API_DOCUMENTATION.md`
- `docs/IMPLEMENTATION_PLAN.md`

During implementation:
- Complete working modules.
- Updated progress tracker.
- Stage-wise audit reports.
- Tests and performance benchmarks.

At the end:
- Production-ready Next.js CMS and e-commerce platform.
- Fully dynamic navbar and footer.
- Dynamic CMS pages.
- Product and category management.
- Dynamic homepage.
- SEO-friendly storefront.
- Complete order management.
- Optimized MongoDB queries and APIs.
- Responsive, consistent UI/UX.

**STARTING INSTRUCTION:**

First inspect the complete existing repository. Understand the current architecture and identify reusable functionality. Then create the complete stage-wise PRD, architecture documents, centralized design system, and progress tracker.

Do not start coding until these documents are complete.

After documentation, begin Stage 1 and follow the mandatory implementation → testing → audit → verification → tracker update workflow for every stage.

Always prioritize a working, secure, fast, maintainable product over unnecessary complexity.