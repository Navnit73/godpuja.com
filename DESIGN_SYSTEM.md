# GodPuja Design System

**Read this file before creating or changing any UI.** Source of truth for values: `src/app/globals.css` (`@theme` + `:root`). If a value you need is missing, add it there **and** document it here first.

## Principles

1. Clean, modern, light theme only (`color-scheme: light`). White page, ink text, one marigold (genda phool) for actions and offers.
2. Flat. Cards are white with a 1px mist border and **no shadow**. Shadows (`elev-*`, neutral and light) are only for menus, drawers, popovers and modals. No glassmorphism, no gradients, no decorative patterns.
3. Only token colors, spacing, radii, fonts. No hex values, arbitrary `px` values, or inline styles in components.
4. Radius scale: **3px** small (tags, badges, code), **4px** medium (buttons, inputs, chips, icon buttons), **5px** large (cards, panels, image plates, modals). Nothing is pill-shaped. `rounded-full` is for true circles only (avatars, dots, progress bars).
5. Same layout language across storefront and admin.
6. WCAG AA contrast, visible focus ring, 44px minimum touch targets on mobile.

> Scale names (`saffron-*`, `kumkum-*`, `gold-*`, `sandal-*`, `tulsi-*`) are kept from the earlier palette so existing classes still work, but the values changed. Read the table below, not the names. Panel utilities `bg-sacred`, `bg-dusk`, `bg-tulsi`, `bg-dawn` are now **flat** fills (ink, ink, green, mist). `pattern-rangoli` is a no-op.

## Color tokens

| Role | Token / class | Value | Use |
|---|---|---|---|
| CTA | `bg-cta` / `text-cta-foreground` (`saffron-500` / `kumkum-900`) | #ffb21e / #14161a | `btn-primary`: Add to cart, Checkout, Pay. Ink text on it is 10:1. **Never use marigold as text** |
| Primary | `primary` (`kumkum-900`) | #14161a | Links, outline buttons, active chips, text-primary |
| Text | `foreground` (`kumkum-900`) | #14161a | body, headings |
| Muted text | `muted` (`kumkum-600`) | #5b616e | secondary text (6.2:1 on white) |
| Background / Surface | `background`, `surface` | #ffffff | page, cards, navbar, inputs |
| Mist | `sandal-100` | #f5f6f8 | image plates, search field, soft panels, `bg-dawn` |
| Border | `border` (`sandal-200`) | #e4e6eb | card edges, dividers (decorative) |
| Input border | `input-border` | #868c99 | form control edges, 3:1+ (WCAG 1.4.11) |
| Accent | `accent` (`gold-600`) | #9a5b08 | focus ring (5:1 on white). On dark panels `gold-300` (#ffc13d) |
| Haldi tint | `saffron-100` / `saffron-800` text | #fff4d9 / #6e4200 | offer panels, primary badges |
| Success | `success` (`tulsi-700`) / `success-soft` (`tulsi-50`) | #0f7b4a / #e3f4ea | in stock, delivery, success banners |
| Danger | `danger` / `danger-soft` | #c62828 / #fdecec | errors, destructive. Red is for errors only |
| Dark panels | `kumkum-950` (#0d0f12), `bg-sacred` (#14161a) | | footer, top bar, admin sidebar, hero. White / `sandal-100` text, `gold-300` highlights |
| Scrim | `scrim` | ink @ 50% | modal and drawer backdrop only |

Full scales are in `globals.css` (`@theme`). Semantic aliases: `danger`/`danger-soft`, `success`/`success-soft`, `warning`/`warning-soft`.

## Storefront

| Token / utility | Use |
|---|---|
| `section-title`, `eyebrow` | section headings (display, extrabold) and small uppercase muted labels |
| `btn-light`, `btn-ghost-light` | buttons on dark panels (`btn-light` is marigold) |
| `icon-btn` | 44px square header actions (search, account, cart), 4px corners |
| `product-tile` | product card: 5px corners, mist border, image on `sandal-100` plate, border darkens on hover. No lift, no shadow |
| `chip` | subcategory / filter chips, 4px corners; active is ink fill |
| `summary-plain`, `pb-safe`, `scrollbar-none` | unchanged (popover summary, iOS safe area, horizontal rails) |

All text/background pairs are covered in `tests/contrast.test.ts`.

## Typography

- Headings, buttons, prices: `font-display` (Plus Jakarta Sans, 500–800, tight tracking). Body/UI: `font-sans` (Hind, 400–600; Latin and Devanagari share one baseline).
- Scale (tokenised as `--text-*` in `globals.css`): xs 12, sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30, 4xl 36, 5xl 48. Body line-height 1.6, headings 1.2.
- Weights: 400 body, 500 UI labels/buttons, 600 headings/emphasis. Admin UI uses `font-sans` throughout, including headings.

## Spacing, radius, containers

- Spacing: Tailwind 4px scale; allowed steps 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 12, 16, 24. No arbitrary values (`w-[…]`, `grid-cols-[…]`). Section vertical rhythm: `py-16` desktop, `py-10` mobile.
- Radius: `rounded-sm` 3px, `rounded-md` 4px, `rounded-lg` 5px. `rounded-xl`/`2xl`/`3xl` also resolve to 5px. No pills.
- Containers: storefront listings `max-w-6xl` (1152), CMS page content `max-w-4xl`, admin content `max-w-7xl`. Horizontal padding `px-4` mobile, `px-6` ≥ sm.
- Breakpoints: Tailwind defaults — sm 640, md 768, lg 1024, xl 1280 — plus `xs` 360 (small phones; header logo/gaps tighten below it so 320px fits). Pages must never be wider than the screen: `body` has `overflow-x: clip` as a safety net, and anything absolutely positioned inside a horizontal rail needs a positioned ancestor inside the rail (`product-tile` is `relative`).

## Elevation

`shadow-elev-1` … `shadow-elev-4` (neutral ink-tinted, defined in `@theme`; menus, drawers and modals only). Motion: `ease-standard`, 150–200 ms.

## Components (utilities in `globals.css`; React wrappers in `src/components/ui`)

| Component | Spec |
|---|---|
| `btn-primary` | marigold fill, ink text, 4px corners, no shadow, hover state-layer 8%, press 14% |
| `btn-outline` | 1.5px ink border, ink text, state layer |
| `btn-ghost` | no border/fill, for toolbars and row actions |
| `btn-danger` | `danger` fill |
| `btn-sm` | `min-h-11` (44px touch target) on mobile, `min-h-8` from `sm` up |
| `badge-*` | `primary`, `success`, `danger`, `muted`; tonal bg + dark text |
| Modal | native `<dialog>`; `rounded-lg`, `elev-4`, `scrim` backdrop; closes on Esc or backdrop press+release |
| Toast | bottom-right, `aria-live="polite"`, auto-dismiss 4 s |
| `card` | `surface`, `rounded-lg`, 1px `sandal-200` border, no shadow |
| `input`, `label`, `field-error`, `alert-error` (Stage 1) | `surface`, 1px `input-border`, `rounded-md`, h-10, focus: 2px `accent` ring; error: `danger` border + message below |
| `data-table` (Stage 2) | `surface` card with `overflow-x-auto`, header `sandal-100`, row divider `border`, row hover `sandal-50`, `<caption class="sr-only">`, `scope="col"`; header is **not** sticky (sticky inside a scroll container never sticks); empty state replaces the table |
| Badge (Stage 2) | `rounded-sm`, tonal bg `*-100` + `*-800` text |
| Navbar | sticky, `surface`, bottom `border`, **no shadow** |
| Admin shell (Stage 2) | sidebar 256px (drawer < lg: hidden from tab order when closed, Esc closes, background `inert` when open), sticky header with breadcrumbs + sign-out, content in `max-w-7xl` |

## Rendered content

`.content` (in `globals.css`) styles CMS markdown output (headings, lists, links, quotes, code, tables, images) with tokens only. Rich text is always rendered through it; never style CMS HTML with one-off classes.

White (`text-white`) is allowed for text on solid status fills (`btn-danger`, error toasts).

## Accessibility

Focus ring: 2px `accent` + 2px offset on every interactive element. Never remove outlines without replacement. Amber (`accent`) is for the focus ring only; marigold is never text; text uses `primary`, `foreground`, or `muted`. Icon-only buttons need `aria-label`. Respect `prefers-reduced-motion`.

## Change process

1. Need a new value → add token to `globals.css`.
2. Document it in this file.
3. Use the token class in components.
