# RouteX (`rrliRev`) — Delivery Operations & Truck Profitability

RouteX is the internal **Delivery Operations & Truck Profitability** system for **Redeemed Route Logistics Inc. (RRLI)**.

## Quick Start

```powershell
cd C:\Users\suchi\Documents\rrli\rrliRev
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Open `http://localhost:3000/login`.

---

## Architecture & Scope Documentation

- [**Revised Scope, Authentication & RBAC Foundation (`docs/REVISED_SCOPE_AND_AUTH_FOUNDATION.md`)**](./docs/REVISED_SCOPE_AND_AUTH_FOUNDATION.md)
- [**Stage 2 Delivery Management Progress (`docs/STAGE_2_DELIVERY_MANAGEMENT_PROGRESS.md`)**](./docs/STAGE_2_DELIVERY_MANAGEMENT_PROGRESS.md)
- [**Supabase PostgreSQL Migration & RLS Policies (`supabase/migrations/20261101000000_routex_revised_foundation.sql`)**](./supabase/migrations/20261101000000_routex_revised_foundation.sql)
- [**Stage 2 Delivery Migration (`supabase/migrations/20261101010000_stage2_delivery_management.sql`)**](./supabase/migrations/20261101010000_stage2_delivery_management.sql)

## Design System Documentation (`docs/design/`)

- [**Design Documentation Index (`docs/design/README.md`)**](./docs/design/README.md)
  1. [`DESIGN_PHILOSOPHY.md`](./docs/design/DESIGN_PHILOSOPHY.md) — Visual identity, design principles, restraint, consistency, and information presentation.
  2. [`DESIGN_TOKENS.md`](./docs/design/DESIGN_TOKENS.md) — Colors, light/dark theme tokens, typography foundations, spacing, radii, shadows, surfaces, and icons.
  3. [`LAYOUT_AND_SPACING.md`](./docs/design/LAYOUT_AND_SPACING.md) — Application shell, collapsible sidebar, topbar, page padding, CSS Grid templates, and responsive breakpoints.
  4. [`COMPONENT_DESIGN.md`](./docs/design/COMPONENT_DESIGN.md) — Reusable UI components: buttons, inputs, `RoundedSelect`, tables, cards, badges, tabs, and `RecordDetailDrawer`.
  5. [`INTERACTION_AND_MOTION.md`](./docs/design/INTERACTION_AND_MOTION.md) — Hover/focus/active states, popover dismissal, portal positioning, transitions, and keyframe animations.
  6. [`TYPOGRAPHY_AND_HIERARCHY.md`](./docs/design/TYPOGRAPHY_AND_HIERARCHY.md) — `Readex Pro` type scale, heading gradients, KPI numerals, uppercase labels, and currency/tabular alignment.
  7. [`UI_STATES_AND_FEEDBACK.md`](./docs/design/UI_STATES_AND_FEEDBACK.md) — Semantic status dots and pills, attention-needed alerts, validation errors, notice banners, empty states, and disabled/locked states.
  8. [`FRONTEND_CONVENTIONS.md`](./docs/design/FRONTEND_CONVENTIONS.md) — Component organization, `globals.css` cascade architecture, browser state synchronization, accessibility rules, and testing standards.
