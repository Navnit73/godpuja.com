# GodPuja Design System

**Read this file before creating or changing any UI.** Source of truth for values: `src/app/globals.css` (`@theme` + `:root`). If a value you need is missing, add it there **and** document it here first.

## Principles

1. Minimal, calm, premium, light theme only (no dark mode, `color-scheme: light`).
2. Material-style depth: soft elevation shadows from tokens; **no glassmorphism** (no blur, no translucent frosted surfaces).
3. Only token colors, spacing, radii, fonts. No hex values, arbitrary `px` values, or inline styles in components.
4. No gradients. Exception: none. (The existing `divider-gold` gradient is replaced with a solid line in Stage 1.)
5. Same layout language across storefront and admin.
6. WCAG AA contrast, visible focus ring, 44px minimum touch targets on mobile.

> Reconciliation note: the source brief says "avoid unnecessary shadows". The owner explicitly asked for Material elevation, so shadows are kept but limited: cards = `elev-1` (hover `elev-3`), primary button = `elev-1`, dropdowns/modals = `elev-4`. Sticky navbar has **no** shadow, only a bottom border.

## Color tokens

| Role | Token / class | Value | Use |
|---|---|---|---|
| Primary | `primary` (`saffron-600`) | #d9600b | CTAs, links, active states |
| Primary hover | `saffron-700` | #b44809 | hover/pressed |
| Text | `foreground` (`kumkum-900`) | #3b0d10 | body, headings |
| Muted text | `muted` | #7a625a | secondary text (AA on `background`) |
| Background | `background` (`sandal-50`) | #fffdf8 | page |
| Surface | `surface` | #ffffff | cards, navbar, tables, inputs |
| Border | `border` (`sandal-300`) | #e9d8b9 | dividers, input borders |
| Accent | `accent` (`gold-500`) | #c19a2e | focus ring, ornaments only (not text on light) |
| Success | `tulsi-500/700` | #4f7f55 / #335738 | success states |
| Danger | `kumkum-600` | #a82a30 | errors, destructive |

Full scales: `saffron-50…900`, `kumkum-50…900`, `gold-50…700`, `sandal-50…400`, `tulsi-50…700`. To add in Stage 1: `warning`, `info`, `danger`, `success` semantic aliases.

## Typography

- Headings: `font-serif` (Cormorant Garamond, 500–700). Body/UI: `font-sans` (Inter).
- Scale (to be tokenised in Stage 1 as `--text-*`): xs 12, sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30, 4xl 36, 5xl 48. Body line-height 1.6, headings 1.2.
- Weights: 400 body, 500 UI labels/buttons, 600 headings/emphasis. Admin UI uses `font-sans` throughout, including headings.

## Spacing, radius, containers

- Spacing: Tailwind 4px scale; use 2/3/4/6/8/12/16/24 only. Section vertical rhythm: `py-16` desktop, `py-10` mobile.
- Radius: `rounded-md` (inputs, small controls), `rounded-xl` (cards, modals), `rounded-full` (buttons, badges). No other radii.
- Containers: storefront `max-w-6xl` (1152), admin content `max-w-7xl`, prose `max-w-3xl`. Horizontal padding `px-4` mobile, `px-6` ≥ sm.
- Breakpoints: Tailwind defaults — sm 640, md 768, lg 1024, xl 1280.

## Elevation

`shadow-elev-1` … `shadow-elev-4` (warm maroon-tinted, defined in `@theme`). Motion: `ease-standard`, 150–200 ms.

## Components (utilities in `globals.css`; React wrappers in `src/components/ui`)

| Component | Spec |
|---|---|
| `btn-primary` | saffron fill, white text, `elev-1`, hover state-layer 8%, press 14% |
| `btn-outline` | saffron-300 border, primary text, state layer |
| `btn-ghost` (Stage 2) | no border/fill, for toolbars |
| `btn-danger` (Stage 2) | kumkum-600 fill |
| `card` | `surface`, `rounded-xl`, `elev-1`, hover `elev-3` (only when clickable) |
| Input (Stage 1) | `surface`, 1px `border`, `rounded-md`, h-10, focus: 2px `accent` ring; error: `danger` border + message below |
| Table (Stage 2) | `surface`, header `sandal-100` bg, row divider `border`, row hover `sandal-50`, sticky header, empty state row |
| Badge (Stage 2) | `rounded-full`, tonal bg `*-100` + `*-700` text |
| Navbar | sticky, `surface`, bottom `border`, **no shadow** |
| Admin shell (Stage 2) | fixed sidebar 256px (collapses < lg), header with breadcrumbs, content in `max-w-7xl` |

## Accessibility

Focus ring: 2px `accent` + 2px offset on every interactive element. Never remove outlines without replacement. Gold (`accent`) is decorative/ring only; text uses `primary`, `foreground`, or `muted`. Icon-only buttons need `aria-label`. Respect `prefers-reduced-motion`.

## Change process

1. Need a new value → add token to `globals.css`.
2. Document it in this file.
3. Use the token class in components.
