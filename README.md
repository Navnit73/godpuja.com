# GodPuja

CMS + e-commerce platform for Hindu puja services and spiritual products. Next.js 16 (App Router) · TypeScript · MongoDB (Mongoose) · Tailwind CSS v4.

Source brief: [prd.md](prd.md). Working docs: [PROJECT_PRD.md](PROJECT_PRD.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [PROJECT_TRACKER.md](PROJECT_TRACKER.md) · [docs/](docs/) (architecture, schema, API, plan, per-stage audits).

## Status

Stages 0–3 done and audited (docs, auth + roles, admin shell + users, CMS pages). See the tracker for what is next.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in MONGODB_URI and AUTH_SECRET (>= 32 chars)
npm run seed:admin             # creates the first superadmin from SEED_ADMIN_* (change that password!)
npm run dev                    # http://localhost:3000  (admin: /admin, sign in at /login)
```

Requires Node ≥ 20.19 and a MongoDB with replica-set/transaction support (Atlas works).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / run the build |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm test` | Vitest (unit + integration against the `godpuja_test` database — never the real one) |
| `npm run audit:browser` | Real-Chrome audit (flows, axe accessibility, console errors, screenshots). Needs a running server and Google Chrome: `BASE=http://localhost:3111 OUT=./audit-out npm run audit:browser` |

## Conventions

- Read [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) before touching UI; use tokens from `src/app/globals.css` only.
- Services (`src/server/services`) are the only code that touches models; route handlers and pages call them.
- Every admin page and API handler re-checks the user from the database (`currentUser` / `requireUser`).
- Homepage: publish a CMS page with slug `home` to show it at `/` (full homepage builder comes in Stage 7).

## Brand assets

`public/logo.svg` (full logo), `public/logo-mark.svg` (mark), `public/icon-512.png` (512px icon) are for external use (social profiles, future PWA manifest). The site itself uses `src/app/icon.svg` and `apple-icon.png`.
