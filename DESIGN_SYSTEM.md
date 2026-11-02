# GodPuja Design System

**Read this file before creating or changing any UI.** Source of truth for values: `src/app/globals.css` (`@theme` + `:root`). If a value you need is missing, add it there **and** document it here first.

## Principles

1. Minimal, calm, premium, light theme only (no dark mode, `color-scheme: light`).
2. Material-style depth: soft elevation shadows from tokens; **no glassmorphism** (no blur, no translucent frosted surfaces).
3. Only token colors, spacing, radii, fonts. No hex values, arbitrary `px` values, or inline styles in components.
4. No gradients (`divider-gold` is now a solid line).
5. Same layout language across storefront and admin.
6. WCAG AA contrast, visible focus ring, 44px minimum touch targets on mobile.

> Reconciliation note: the source brief says "avoid unnecessary shadows". The owner explicitly asked for Material elevation, so shadows are kept but limited: cards = `elev-1` (hover `elev-3`), primary button = `elev-1`, dropdowns/modals = `elev-4`. Sticky navbar has **no** shadow, only a bottom border.

## Color tokens

| Role | Token / class | Value | Use |
|---|---|---|---|
| Primary | `primary` (`saffron-700`) | #b44809 | CTAs, links, active states. White on it is 5.6:1 (AA); `saffron-600` (#d9600b, 3.7:1) is **graphic only** (logo mark), never for text |
| Primary hover | `saffron-800` | #8f380f | hover/pressed |
| Text | `foreground` (`kumkum-900`) | #3b0d10 | body, headings |
| Muted text | `muted` | #7a625a | secondary text (AA on `background`) |
| Background | `background` (`sandal-50`) | #fffdf8 | page |
| Surface | `surface` | #ffffff | cards, navbar, tables, inputs |
| Border | `border` (`sandal-300`) | #e9d8b9 | dividers, card edges (decorative) |
| Input border | `input-border` | #9a8475 | form control edges — 3.3:1+ on surface/background (WCAG 1.4.11, Stage 11) |
| Accent | `accent` (`gold-600`) | #9a7623 | focus ring (≥3:1 on white), divider ornament. Not for body text |
| Success | `success` (`tulsi-700`) / `success-soft` (`tulsi-50`) | #335738 / #f2f7f2 | success text and tonal badges (AA). `tulsi-500` is decorative only |
| Danger | `danger` (`kumkum-600`) / `danger-soft` | #a82a30 | errors, destructive |
| Scrim | `scrim` | maroon @ 45% | modal and mobile-drawer backdrop only (the single translucent token; no frosted/blurred surfaces) |

Full scales: `saffron-50…900`, `kumkum-50…900`, `gold-50…700`, `sandal-50…400`, `tulsi-50…700`. Semantic aliases (Stage 1): `danger`/`danger-soft`, `success`/`success-soft`, `warning`/`warning-soft`.

## Typography

- Headings: `font-serif` (Cormorant Garamond, 500–700). Body/UI: `font-sans` (Inter).
- Scale (tokenised as `--text-*` in `globals.css`): xs 12, sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30, 4xl 36, 5xl 48. Body line-height 1.6, headings 1.2.
- Weights: 400 body, 500 UI labels/buttons, 600 headings/emphasis. Admin UI uses `font-sans` throughout, including headings.

## Spacing, radius, containers

- Spacing: Tailwind 4px scale; allowed steps 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 12, 16, 24. No arbitrary values (`w-[…]`, `grid-cols-[…]`). Section vertical rhythm: `py-16` desktop, `py-10` mobile.
- Radius: `rounded-md` (inputs, small controls), `rounded-xl` (cards, modals), `rounded-full` (buttons, badges). No other radii.
- Containers: storefront listings `max-w-6xl` (1152), CMS page content `max-w-4xl`, admin content `max-w-7xl`. Horizontal padding `px-4` mobile, `px-6` ≥ sm.
- Breakpoints: Tailwind defaults — sm 640, md 768, lg 1024, xl 1280.

## Elevation

`shadow-elev-1` … `shadow-elev-4` (warm maroon-tinted, defined in `@theme`). Motion: `ease-standard`, 150–200 ms.

## Components (utilities in `globals.css`; React wrappers in `src/components/ui`)

| Component | Spec |
|---|---|
| `btn-primary` | saffron fill, white text, `elev-1`, hover state-layer 8%, press 14% |
| `btn-outline` | saffron-300 border, primary text, state layer |
| `btn-ghost` | no border/fill, for toolbars and row actions |
| `btn-danger` | `danger` fill |
| `btn-sm` | `min-h-11` (44px touch target) on mobile, `min-h-8` from `sm` up |
| `badge-*` | `primary`, `success`, `danger`, `muted`; tonal bg + dark text |
| Modal | native `<dialog>`; `rounded-xl`, `elev-4`, `scrim` backdrop; closes on Esc or backdrop press+release |
| Toast | bottom-right, `aria-live="polite"`, auto-dismiss 4 s |
| `card` | `surface`, `rounded-xl`, `elev-1`, hover `elev-3` (only when clickable) |
| `input`, `label`, `field-error`, `alert-error` (Stage 1) | `surface`, 1px `input-border`, `rounded-md`, h-10, focus: 2px `accent` ring; error: `danger` border + message below |
| `data-table` (Stage 2) | `surface` card with `overflow-x-auto`, header `sandal-100`, row divider `border`, row hover `sandal-50`, `<caption class="sr-only">`, `scope="col"`; header is **not** sticky (sticky inside a scroll container never sticks); empty state replaces the table |
| Badge (Stage 2) | `rounded-full`, tonal bg `*-100` + `*-700` text |
| Navbar | sticky, `surface`, bottom `border`, **no shadow** |
| Admin shell (Stage 2) | sidebar 256px (drawer < lg: hidden from tab order when closed, Esc closes, background `inert` when open), sticky header with breadcrumbs + sign-out, content in `max-w-7xl` |

## Rendered content

`.content` (in `globals.css`) styles CMS markdown output (headings, lists, links, quotes, code, tables, images) with tokens only. Rich text is always rendered through it; never style CMS HTML with one-off classes.

White (`text-white`) is allowed for text on solid status fills (`btn-danger`, error toasts).

## Accessibility

Focus ring: 2px `accent` + 2px offset on every interactive element. Never remove outlines without replacement. Gold (`accent`) is decorative/ring only; text uses `primary`, `foreground`, or `muted`. Icon-only buttons need `aria-label`. Respect `prefers-reduced-motion`.

## Change process

1. Need a new value → add token to `globals.css`.
2. Document it in this file.
3. Use the token class in components.
