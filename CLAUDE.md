# CLAUDE.md — RouteX AI Coding Agent Guide

This file provides critical guidance and commands for Claude Code and other AI coding tools working on the **RouteX** codebase.

---

## 1. Commands

Always run commands from the active application directory `rrliRev/`:

```bash
# Navigate to active application
cd rrliRev

# Run all 171+ automated tests (Node native test runner)
npm test

# Run strict TypeScript typecheck
npm run typecheck

# Build for production (Next.js Turbopack)
npm run build

# Start local development server
npm run dev
```

> **IMPORTANT:** Never submit code changes that fail `npm test`, `npm run typecheck`, or `npm run build`.

---

## 2. Project Architecture

- **Active Application:** `rrliRev/` is the active Next.js App Router codebase (Next.js 16.4.2, React 19, TypeScript 5, Tailwind 4).
- **Routes (`rrliRev/src/app/`):**
  - `(auth)/login` — Split-screen authentication form.
  - `(workspace)/dashboard` — Operational overview, KPIs, and recent deliveries (5/page).
  - `(workspace)/deliveries` — Deliveries ledger (10/page), filter dropdowns, drawer inspector, `/new` multi-step wizard, `/import` Excel parser.
  - `(workspace)/truck-profitability` — Owned truck cards, subcontracted trucks (10/page), fleet crew management (10/page).
  - `(workspace)/truck-profitability/[plate]` — Individual truck profile, unit economics, delivery history (10/page).
  - `(workspace)/pod-documents` — Stop-level proof-of-delivery document attachments (10/page).
  - `(workspace)/reports` — Built-in & custom reports engine, daily trip report, Excel CSV export.
  - `(workspace)/user-management` — Authorized staff accounts (10/page) and immutable audit log (10/page) (Admin only).
  - `(workspace)/settings` — Profile settings and credentials self-management.
  - `api/` — Route handlers for deliveries, documents, trucks, drivers, users, reports, audit.

---

## 3. High-Priority Business Rules & Invariants

1. **Terminology Standard & Simplified UI:**
   - Always use **"Revenue"** (or "Delivery Revenue" in formal/legal contexts; never "rate", "billing", "gross revenue", or "sales"). In compact UI contexts (cards, stat headers, table columns), use **"Revenue"** to prevent clunky wrapping and redundancy.
   - Always use **"Expenses"** (or "Trip Expenses"; never "operational costs" or "fleet overhead"). In compact UI contexts, use **"Expenses"**.
   - Always use **"Store Drop-offs"** or **"Drop-offs"** (never "stops" or "drops").
   - Always use **"Net Profit"** and **"Profit Margin"**.
   - Always use **"POD Attached"** vs **"Missing POD"** (never "Verified" / "Pending Verification").

2. **Financial Calculation & Resolution:**
   - Any delivery with `unknown` expenses is in an `"incomplete"` financial state and clearly marked as "Incomplete".
   - Incomplete deliveries **MUST BE EXCLUDED** from aggregate revenue, expense, and profit totals until resolved.
   - Never silently zero an unknown expense!
   - **No Manual Finalize Button:** Edit delivery is the single action. Once all expenses are completed/resolved, the delivery is automatically finalized and included in computations.

3. **Delivery Recording Window:**
   - **Admin** has unrestricted authority to record/edit deliveries across any past or future date.
   - **Operations** is restricted to a **3-day submission window** from the delivery date.

4. **Table Pagination:**
   - Always use `<TablePagination />` from `@/components/table-pagination`.
   - **Dashboard Recent Deliveries:** Exactly **5 records**, fixed without pagination (top 5 recent).
   - **All Other Tables:** Exactly **10 records per page** (with `<TablePagination />`).
   - Features typed page number input (`Page [ 1 ] of X`), Enter key, boundary clamping, and Prev/Next buttons.

5. **Date Filtering:**
   - Global workspace filter defaults to **"All Time"** (`startDate: null, endDate: null`).
   - Daily Trip Report on `/reports` has a dedicated fixed single-day picker.

6. **Dual-Mode Persistence:**
   - RouteX supports offline database-free preview mode via `small-mock-database.ts` and `localStorage`.
   - When `NEXT_PUBLIC_SUPABASE_URL` is set, it uses the Supabase PostgreSQL repository with RLS.
   - Never break offline preview mode when implementing backend changes!

7. **Styling:**
   - Single authoritative stylesheet at `rrliRev/src/app/globals.css`.
   - **NO CSS Modules (`*.module.css`)** — causes Turbopack issues in this repository.
   - Support both light and dark modes (`html[data-theme="dark"]`).

---

## 4. Test Accounts

Sign in at `/login` with username / password:
- `admin` / `password123` (Admin — Full system management)
- `operations` / `password123` (Operations — Dispatch & delivery execution)
- `finance` / `password123` (Finance — View-only financials & reports)
- `hr` / `password123` (HR — View-only crew management)
- `secretary` / `password123` (Secretary — View-only deliveries & PODs)
- `customerrep` / `password123` (Customer Representative — View-only tracking)
