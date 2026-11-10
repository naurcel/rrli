# RouteX: Company-Wide Expense Ledger & Profitability Tracking Implementation Review

**Document Version:** 1.0.0  
**Date:** November 9, 2026  
**System:** RouteX Logistics Management System — Redeemed Route Logistics Inc. (RRLI)  
**Status:** Implemented, Verified, and Tested (Zero Regressions, 201/201 Passing Tests)

---

## Executive Summary

RouteX has been successfully expanded from a delivery operations and truck profitability system into a comprehensive **Company Profitability Management System**. 

The new **Finance** module (`/finance`) introduces a company-wide operating expense ledger that records non-delivery expenses (such as facility rent, utilities, office supplies, admin salaries, and general hub maintenance) without requiring or forcing allocation to individual deliveries, trucks, or clients.

All existing delivery operations, multi-store drop-offs, proof of delivery (POD) verification, and truck profitability metrics remain completely intact and strictly isolated.

---

## 1. Architectural & Domain Model

### A. Canonical Profitability Formula
Company-wide profitability is calculated strictly according to the formula:

$$\text{Company Net Profit} = \text{Total Delivery Revenue} - \text{Total Delivery Expenses} - \text{Total Company Expenses}$$

$$\text{Company Profit Margin} = \left(\frac{\text{Company Net Profit}}{\text{Total Delivery Revenue}}\right) \times 100$$

Where:
- **Total Delivery Revenue:** Sum of delivery rates from confirmed, financially finalized deliveries within the active date range.
- **Total Delivery Expenses:** Sum of trip expenses (Diesel Fuel + Highway Tolls + Store Entry Fees + Crew Compensation + Other Expenses) from confirmed, financially finalized deliveries.
- **Total Company Expenses:** Sum of company-wide operating expenses recorded in the new Company Expense ledger within the active date range.

### B. Financial Integrity & Incomplete Delivery Invariants
- **Incomplete Deliveries Excluded:** In accordance with established RRLI financial rules, deliveries with unresolved `unknown` expenses remain marked `incomplete` and **are excluded** from delivery revenue and delivery expense KPI totals.
- **No Silent Zeroing:** Missing expenses are never treated as zero.
- **Truck Profitability Isolation:** Company-wide operating expenses are **never** allocated to individual trucks. Truck profitability rankings, per-truck margins, and individual truck ledgers (`/truck-profitability` and `/truck-profitability/[plate]`) continue to reflect only delivery-level revenue and expenses.

---

## 2. New Finance Module (`/finance`)

### A. Navigation & Shell Layout
- Added **Finance** (`/finance`, symbol `◈`) to the primary workspace navigation in `WORKSPACE_NAVIGATION_ITEMS`.
- Accessible to all roles under `finance:view`.
- Full write capabilities (`finance:manage`) restricted to **Admin** and **Operations**.
- Standardized under the workspace layout shell (`OperationalTopbar contextLabel="Finance"`), preventing duplicate sidebars.

### B. Streamlined Total Expense Entry (No Breakdown, No Tags)
- **Direct Input Flow:** Directly inputs final total company expenses without sub-breakdown or tag selection.
- **Visually Centered Hero Amount Input:** High-contrast PHP (₱) currency input centered on the page with real-time validation and active focus highlights.
- **Input Validation:**
  - Description automatically defaults to `"Total Company Expenses"` if omitted.
  - Strict positive number validation (rejects zero, negatives, and non-numeric inputs).
  - Two decimal places precision rounding.
  - Company foundation date boundary enforcement (rejects dates prior to `2024-01-01`).
- **Optional Note Field:** Simple memo/notes field for transaction reference, invoice number, or check vouchers.

### C. Ledger Table & Pagination
- Displays: **Date | Total Amount (₱) | Note / Reference | Recorded By | Actions (Edit, Delete)**.
- Clean typography and formatting without redundant category badges or distribution widgets.
- Real-time search by notes or reference.
- Sortable by date and amount (ascending/descending).
- Strictly **10 records per page** powered by the shared `<TablePagination />` component with direct page number jumping.

### D. Zero Breakdown & Visual Simplification
- In accordance with RRLI operating requirements, company operating expenses are recorded as a single top-level total.
- **No sub-breakdowns:** Operating expenses are not divided into delivery-style sub-components.
- **No category tags:** Removed tag taxonomies and filters.
- **No distribution graphs:** Removed categorical distribution progress bars and monthly distribution charts to maintain a focused, distraction-free ledger.

### E. Edit & Audited Deletion Workflows
- **Edit Modal (`<EditCompanyExpenseModal />`):** Allows modifying amount, date, and notes with full validation.
- **Audited Deletion Dialog (`<ConfirmExpenseDeletionDialog />`):** Requires administrative confirmation, captures deletion reason, and records an audited deletion entry in the audit trail.

---

## 3. Database & Dual-Mode Architecture

RouteX maintains dual-mode storage compatibility:

### A. PostgreSQL / Supabase Mode
- **Migration:** `supabase/migrations/20261109000000_company_expenses.sql`
- **Table Definition:** `public.company_expenses`
  - `id uuid primary key default gen_random_uuid()`
  - `description text not null check (char_length(description) >= 2)`
  - `amount numeric(12, 2) not null check (amount > 0)`
  - `expense_date date not null check (expense_date >= '2024-01-01')`
  - `category text not null default 'Other Operating Expenses'`
  - `notes text`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- **Row-Level Security (RLS):**
  - Read access: Granted to all authenticated workspace members (`can_view_workspace()`).
  - Write access: Granted exclusively to Admin and Operations (`can_write_operations()`).
- **Indexes:** Created on `expense_date` and `category` for fast date-range filtering.

### B. Database-Free Preview Mode (Offline Fallback)
- **Local Storage Key:** `routex_company_expenses`
- **Reactive Custom Event:** `ROUTEX_COMPANY_EXPENSES_CHANGED`
- **Initial Seed Data:** 9 realistic Q4 2026 operating expenses seeded in `SMALL_MOCK_COMPANY_EXPENSES` (`small-mock-database.ts`).

---

## 4. Dashboard & Reports Updates

### A. Dashboard KPI Grid
The Dashboard top financial grid has been upgraded to four unambiguous cards:
1. **DELIVERY REVENUE:** Revenue generated from confirmed delivery trips (linked to `/deliveries`).
2. **DELIVERY EXPENSES:** Diesel fuel, highway tolls, entry fees, and crew compensation (linked to `/deliveries`).
3. **COMPANY EXPENSES:** Company-wide operating expenses from the Finance ledger (linked to `/finance`).
4. **COMPANY NET PROFIT:** Net profitability after deducting both delivery and company expenses, displaying overall profit margin percentage (linked to `/finance`).

### B. Operational Reports Integration
- Updated `report-engine.ts` (`processReport`, `generateReportRows`, `generateReportCsv`):
  - In Client Summary and Trip Ledger reports, `totalCompanyExpenses` and `companyNetProfit` are computed and included in report summaries and exported CSV files.
  - In Truck Profitability reports (`truck_summary`), company expenses are strictly 0 to preserve truck-level attribution integrity.
- In `src/app/(workspace)/reports/page.tsx`, `<GlobalDateRangePicker />` filters both deliveries and company expenses simultaneously.

---

## 5. Security & RBAC Enforcement

| Role | Access Level | Permissions | Finance Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | Full System | `finance:view`, `finance:manage` | View ledger, add expenses, edit expenses, delete expenses with reason |
| **Operations** | Dispatch & Ops | `finance:view`, `finance:manage` | View ledger, add expenses, edit expenses, delete expenses with reason |
| **Finance** | View-Only | `finance:view` | View ledger, filter by date/category, export reports |
| **HR** | View-Only | `finance:view` | View ledger, filter by date/category |
| **Secretary** | View-Only | `finance:view` | View ledger, filter by date/category |
| **Customer Rep** | View-Only | `finance:view` | View ledger, filter by date/category |

Server API routes (`/api/finance/expenses`, `/api/finance/expenses/[id]`) enforce authentication via session tokens and return `403 Forbidden` for unauthorized mutations.

---

## 6. Audit Trail Integration

All expense lifecycle actions are recorded via `recordAuditEntry`:
- `company_expense.created`: Logs description, amount, date, and category.
- `company_expense.updated`: Logs field-level before/after diffs for modified values.
- `company_expense.deleted`: Logs deleted entity details, administrator identity, and deletion reason.

---

## 7. Verification & Test Coverage

### Test Suites Summary
- **Total Test Suites:** 15 suites
- **Total Tests:** 201 tests
- **Passing Tests:** 201 (100% pass rate)
- **Failed Tests:** 0
- **TypeScript Typecheck (`tsc --noEmit`):** Exit code 0 (Zero errors)
- **Next.js Production Build (`next build`):** 17 static & dynamic routes compiled cleanly with Turbopack

### Dedicated Finance Test Suites
1. **Domain Model & Validation (`src/features/finance/company-expense-domain.test.ts`):** 9 tests covering profitability formulas, zero revenue handling, negative profit handling, boundary validation, and monthly aggregations.
2. **Server Repository & Persistence (`src/features/finance/company-expense-repository.test.ts`):** 4 tests covering CRUD operations, search filters, date range summaries, and audit trail logging.
3. **System Integration (`src/features/finance/company-profitability-integration.test.ts`):** 8 tests verifying end-to-end company net profit formulas, incomplete delivery exclusion, truck isolation, report engine integration, and RBAC permission enforcement.

---

## 8. Summary of Created & Modified Files

### Created Files
- `src/features/finance/company-expense-domain.ts`
- `src/features/finance/company-expense-domain.test.ts`
- `src/features/finance/browser-preview-expenses.ts`
- `src/features/finance/server/company-expense-repository.ts`
- `src/features/finance/server/company-expense-repository.test.ts`
- `src/features/finance/company-profitability-integration.test.ts`
- `src/app/api/finance/expenses/route.ts`
- `src/app/api/finance/expenses/[id]/route.ts`
- `src/app/api/finance/summary/route.ts`
- `src/components/confirm-expense-deletion-dialog.tsx`
- `src/components/edit-company-expense-modal.tsx`
- `src/app/(workspace)/finance/page.tsx`
- `supabase/migrations/20261109000000_company_expenses.sql`
- `docs/reviews/COMPANY_EXPENSES_IMPLEMENTATION.md`

### Modified Files
- `package.json` (Added 3 new test suites to `test` script)
- `src/lib/auth/rbac.ts` (Added `finance:view`, `finance:manage`, `canManageCompanyExpenses`, `/finance` navigation item)
- `src/lib/auth/route-policy.ts` (Mapped `/finance` and `/api/finance` to `finance:view`)
- `src/features/audit/audit-formatters.ts` (Added label formatting for expense attributes)
- `src/lib/audit/server-audit-store.ts` (Fixed testability guard for Node test runner)
- `src/features/deliveries/small-mock-database.ts` (Added `SMALL_MOCK_COMPANY_EXPENSES` seed data)
- `src/app/(workspace)/dashboard/page.tsx` (Added company expenses loading, 4 KPI cards, updated profit margin)
- `src/features/reports/report-engine.ts` (Added `totalCompanyExpenses` and `companyNetProfit` calculations and CSV formatting)
- `src/app/(workspace)/reports/page.tsx` (Integrated company expenses with date filtering and summary cards)
- `src/app/globals.css` (Added finance hero input, entry card, visual summaries, category badges, and dark mode styling)
