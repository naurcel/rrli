# RouteX — Delivery Operations & Truck Profitability

RouteX is the internal **Delivery Operations, Multi-Store Drop-offs, POD Documents, and Truck Profitability** system for **Redeemed Route Logistics Inc. (RRLI)**.

---

## Quick Start for Developers & AI Agents

> **Note for AI Coding Agents (Antigravity, Cursor, Claude Code, Windsurf, Copilot):**  
> Read [`AGENTS.md`](./AGENTS.md) and [`CLAUDE.md`](./CLAUDE.md) before writing or modifying code.  
> The active application codebase is located inside [`rrliRev/`](./rrliRev). Always execute npm commands from `rrliRev/`.

### 1. Install & Run Locally

```bash
# Navigate to active application workspace
cd rrliRev

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/login`).

### 2. Verify Changes (Strict Verification Gate)

Before committing or submitting changes, all three commands must pass:

```bash
cd rrliRev

# Run all 171 automated tests across 12 suites
npm test

# Verify zero TypeScript type errors
npm run typecheck

# Verify Next.js production build succeeds
npm run build
```

---

## Test Accounts & Demo Access

RouteX includes full Role-Based Access Control (RBAC) with seeded preview credentials:

| Role | Username | Access Level | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | Full System Management | Full system access, staff provisioning, audit logs, unlimited delivery date recording, record deletion |
| **Operations** | `operations` | Dispatch & Execution | Record deliveries (3-day window), fleet management, POD document uploads, Excel spreadsheet import |
| **Finance** | `finance` | View-Only | View all deliveries, financial breakdowns, unit economics, custom reports, CSV export |
| **HR** | `hr` | View-Only | View fleet crew (drivers/helpers), report views |
| **Secretary** | `secretary` | View-Only | View deliveries, multi-store drop-offs, POD document compliance |
| **Customer Rep** | `customerrep` | View-Only | View delivery status and client store drop-offs |

**Password for all test accounts:** `password123` (or click "Sign In as Admin" on `/login`).

---

## Architecture & Storage Modes

RouteX runs in two operating modes out of the box:

1. **Database-Free Preview Mode (Default):**
   - When Supabase environment variables are absent, RouteX serves seeded fixtures from [`small-mock-database.ts`](./rrliRev/src/features/deliveries/small-mock-database.ts), cache layers, and `localStorage` with window event synchronization.
   - Allows full offline development, testing, and UI review without database setup.
   - **Rule:** Never break offline preview mode when adding backend features!
2. **Supabase Connected Mode:**
   - When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are provided in `.env.local`, RouteX connects to Supabase PostgreSQL using Row-Level Security (RLS) migrations in [`rrliRev/supabase/migrations/`](./rrliRev/supabase/migrations/).
   - POD documents are stored in Supabase Storage with 5-minute signed URLs.

---

## Core Domain Rules & Invariants

1. **Canonical Terminology:**
   - Use **"Delivery Revenue"** (never "rate", "billing", or "gross revenue").
   - Use **"Trip Expenses"** (Diesel Fuel + Highway Tolls + Store Entry Fees + Crew Compensation + Other Expenses).
   - Use **"Store Drop-offs"** (never "stops" or "drops").
   - Use **"Net Profit"** and **"Profit Margin"**.
   - Use **"POD Attached"** vs. **"Missing POD"**.
2. **Financial Finalization:**
   - Deliveries with `unknown` expenses are in an `incomplete` financial state and are **strictly excluded** from aggregate revenue, expense, and profit totals until finalized.
   - Never silently zero an unknown expense.
3. **Delivery Recording Window:**
   - **Admin:** Can record or edit deliveries on any date with no window restriction.
   - **Operations:** Constrained to a 3-day submission window from the delivery date.
4. **Table Pagination Standards:**
   - Always use `<TablePagination />` from `@/components/table-pagination`.
   - **Dashboard Recent Deliveries Table:** Strictly **5 records**, fixed without pagination (top 5 recent).
   - **All Other Tables:** Strictly **10 records per page** (with `<TablePagination />`).
   - Features typed page number input (`Page [ 1 ] of X`), Enter key, onBlur, boundary clamping, and Prev/Next buttons.
5. **Styling Rules:**
   - All styles belong in [`rrliRev/src/app/globals.css`](./rrliRev/src/app/globals.css).
   - **NEVER use CSS Modules (`*.module.css`)** — causes Turbopack issues in this repository.

---

## Documentation Index

- **AI Agent Guidelines:** [`AGENTS.md`](./AGENTS.md) and [`CLAUDE.md`](./CLAUDE.md)
- **Current Implementation State:** [`docs/CURRENT_IMPLEMENTATION_STATE.md`](./docs/CURRENT_IMPLEMENTATION_STATE.md)
- **RBAC & Use Case Guide:** [`docs/USE_CASE_DIAGRAM_RBAC_GUIDE.md`](./docs/USE_CASE_DIAGRAM_RBAC_GUIDE.md)
- **Design System Documentation:** [`rrliRev/docs/design/`](./rrliRev/docs/design/README.md)
  - [`DESIGN_PHILOSOPHY.md`](./rrliRev/docs/design/DESIGN_PHILOSOPHY.md) — Visual identity & design principles.
  - [`DESIGN_TOKENS.md`](./rrliRev/docs/design/DESIGN_TOKENS.md) — Color palette, surface treatments, and elevation.
  - [`COMPONENT_DESIGN.md`](./rrliRev/docs/design/COMPONENT_DESIGN.md) — Reusable UI primitives, tables, and pagination.
  - [`LAYOUT_AND_SPACING.md`](./rrliRev/docs/design/LAYOUT_AND_SPACING.md) — Application shell, sidebar, and grid layouts.
  - [`FRONTEND_CONVENTIONS.md`](./rrliRev/docs/design/FRONTEND_CONVENTIONS.md) — Coding conventions & architecture.
- **Audit & Engineering Reviews:** [`docs/reviews/`](./docs/reviews/)
  - [`OVERNIGHT_MAINTENANCE_REPORT.md`](./docs/reviews/OVERNIGHT_MAINTENANCE_REPORT.md)
  - [`SCALABILITY_AND_FUTURE_READINESS_AUDIT.md`](./docs/reviews/SCALABILITY_AND_FUTURE_READINESS_AUDIT.md)
  - [`TERMINOLOGY_AUDIT.md`](./docs/reviews/TERMINOLOGY_AUDIT.md)
  - [`UI_FUNCTIONAL_AUDIT.md`](./docs/reviews/UI_FUNCTIONAL_AUDIT.md)
