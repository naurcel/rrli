# RouteX (`rrliRev`) — Delivery Operations & Truck Profitability

RouteX is the internal **Delivery Operations & Truck Profitability** system for **Redeemed Route Logistics Inc. (RRLI)**.

---

## Developer & AI Coding Agent Quick Start

> **Primary Working Project Notice:**  
> `rrliRev` is the primary, self-contained working project for RouteX. Review [`AGENTS.md`](./AGENTS.md) and [`CLAUDE.md`](./CLAUDE.md) for strict developer instructions, and consult the [Central Knowledge Base (`docs/knowledge-base/`)](./docs/knowledge-base/) for authoritative domain architecture and business rules.

### 1. Daily Development Workflow

```powershell
# Run the complete test suite (222+ tests across 16 suites)
npm test

# Run strict TypeScript verification (must exit code 0)
npm run typecheck

# Build the Next.js production bundle with Turbopack (all 33 routes)
npm run build

# Start local development server on http://localhost:3000
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

### 2. Test Credentials

- **Admin:** `admin` / `password123` (Full system management)
- **Operations:** `operations` / `password123` (Deliveries, 3-day recording window, fleet, PODs)
- **Finance:** `finance` / `password123` (View-only financials & reports)
- **HR:** `hr` / `password123` (View-only fleet crew)
- **Secretary:** `secretary` / `password123` (View-only deliveries & PODs)
- **Customer Rep:** `customerrep` / `password123` (View-only delivery status)

---

## Architecture & Storage Modes

### Database-Free Preview Mode (Default)
When Supabase environment variables are omitted, RouteX runs entirely in-memory and in-browser:
- Serves verified fixtures via [`src/features/deliveries/small-mock-database.ts`](./src/features/deliveries/small-mock-database.ts).
- Client mutations are persisted in `localStorage` and synchronized across tabs via custom window events (`ROUTEX_DELIVERIES_CHANGED`, `BROWSER_PREVIEW_TRUCKS_CHANGED`, `BROWSER_CREW_STATUS_CHANGED`).
- POD documents generate instant offline SVG receipts with inline viewing and downloading.
- **Rule:** Never break offline preview mode when implementing backend changes!

### Supabase Connected Mode
When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured:
- Connects to Supabase PostgreSQL using SQL migrations in [`supabase/migrations/`](./supabase/migrations/).
- Leverages Row-Level Security (RLS) policies for multi-tenant and role isolation.
- Uploads binary documents to Supabase Storage with 5-minute pre-signed URLs.

---

## Central Documentation Center (`docs/`)

- [**Master Documentation Index (`docs/README.md`)**](./docs/README.md)
- [**Central Knowledge Base (`docs/knowledge-base/`)**](./docs/knowledge-base/) — 14 authoritative specification documents covering project overview, architecture, tech stack, database, business rules, RBAC, security, API logic, file management, and QA.

---

## Design System Documentation (`docs/design/`)

- [**Design Documentation Index (`docs/design/README.md`)**](./docs/design/README.md)
  1. [`DESIGN_PHILOSOPHY.md`](./docs/design/DESIGN_PHILOSOPHY.md) — Visual identity, design principles, restraint, consistency, and information presentation.
  2. [`DESIGN_TOKENS.md`](./docs/design/DESIGN_TOKENS.md) — Colors, light/dark theme tokens, typography foundations, spacing, radii, shadows, surfaces, and icons.
  3. [`LAYOUT_AND_SPACING.md`](./docs/design/LAYOUT_AND_SPACING.md) — Application shell, collapsible sidebar, topbar, page padding, CSS Grid templates, and responsive breakpoints.
  4. [`COMPONENT_DESIGN.md`](./docs/design/COMPONENT_DESIGN.md) — Reusable UI components: buttons, inputs, `RoundedSelect`, `TablePagination`, filter dropdowns, timeline, and `RecordDetailDrawer`.
  5. [`INTERACTION_AND_MOTION.md`](./docs/design/INTERACTION_AND_MOTION.md) — Hover/focus/active states, popover dismissal, portal positioning, transitions, and keyframe animations.
  6. [`TYPOGRAPHY_AND_HIERARCHY.md`](./docs/design/TYPOGRAPHY_AND_HIERARCHY.md) — `Readex Pro` type scale, heading gradients, KPI numerals, uppercase labels, and currency/tabular alignment.
  7. [`UI_STATES_AND_FEEDBACK.md`](./docs/design/UI_STATES_AND_FEEDBACK.md) — Semantic status dots and pills, attention-needed alerts, validation errors, notice banners, empty states, and disabled/locked states.
  8. [`FRONTEND_CONVENTIONS.md`](./docs/design/FRONTEND_CONVENTIONS.md) — Component organization, `globals.css` cascade architecture, browser state synchronization, accessibility rules, and testing standards.
