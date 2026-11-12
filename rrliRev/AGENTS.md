# RouteX: AI Agent & Developer Operating Manual

> **FOR ALL AI AGENTS & DEVELOPERS:**  
> This file is the primary, self-contained operational specification for RouteX. Read this before writing, modifying, or testing code in `rrliRev/`.

---

## 1. Project Overview & Primary Workspace

RouteX is the internal **Delivery Operations, Multi-Store Drop-offs, POD Documents, and Truck Profitability** system for **Redeemed Route Logistics Inc. (RRLI)**.

- **Primary Working Directory:** All active application code, tests, and documentation live inside [`rrliRev/`](file:///c:/Users/suchi/Documents/rrli/rrliRev).
- **Independent Project:** Never depend on parent `rrli/` root files or create parallel directories at the root. `rrliRev/` is fully independent.
- **Command Working Directory:** Execute all commands from `rrliRev/`:
  ```powershell
  cd rrliRev
  npm test
  npm run typecheck
  npm run build
  npm run dev
  ```

---

## 2. Verification Gates (Strict Requirements)

Before submitting any turn or code change, run and verify all three gates:

1. **Unit & Integration Tests (100% Pass Rate Required):**
   ```powershell
   npm test
   ```
   Uses Node's built-in test runner (`node --test --experimental-strip-types`). All 222+ tests across 16 suites must pass with zero failures or skipped tests.
2. **TypeScript Strict Typecheck (Zero Errors Required):**
   ```powershell
   npm run typecheck
   ```
   Must exit with code 0 (`tsc --noEmit`).
3. **Next.js Production Build:**
   ```powershell
   npm run build
   ```
   Next.js Turbopack must compile all 33+ routes cleanly without errors.

---

## 3. Core Business Rules & Invariants

Always uphold these domain invariants:

### A. Canonical Terminology
- **"Revenue"** (or "Delivery Revenue" in formal contexts; never use "rate", "billing", "gross revenue", or "sales").
- **"Expenses"** (or "Trip Expenses" = Diesel + Tolls + Store Entry Fees + Crew Pay + Other; never use "operational costs" or "fleet overhead").
- **"Store Drop-offs"** or **"Drop-offs"** (never use "stops" or "waypoints").
- **"Net Profit"** & **"Profit Margin"** (`(Net Profit / Revenue) * 100`).
- **"POD Attached"** vs. **"Missing POD"** (never use "Verified" / "Pending Verification").

### B. Financial Integrity & Zero-Tolerance for Silent Zeroes
- **Deliveries with `unknown` expenses are marked `incomplete`.**
- Deliveries in the `incomplete` financial state **MUST BE EXCLUDED** from aggregate revenue, expense, and profit KPI totals until finalized.
- **NEVER SILENTLY ZERO AN UNKNOWN EXPENSE.**
- `not_applicable` expenses evaluate to confirmed `null` with `0.00` impact and do not block finalization.
- Under Truck Profitability, unfinalized delivery revenue may be displayed as a distinct `+ ₱X pending` indicator, but must remain separate from finalized revenue.
- **Automatic Financial Resolution:** No separate "Finalize Financials" button. Dispatchers edit the delivery to resolve unknown values; once all are resolved, the trip automatically becomes `finalized`.
- **Company Expenses Entry:** The company's overall expenses are entered at `/finance` as a **single total amount**, date, and optional note. No category tags or distributions.

### C. Profitability Calculation Rules
- **Delivery Net Profit:** $\text{Delivery Revenue} - \text{Total Trip Expenses}$
- **Truck Profitability:** Strictly isolated from company-wide expenses. Evaluates solely trips attributable to that specific truck plate.
- **Company Net Profit:** $\text{Total Delivery Revenue} - \text{Total Delivery Expenses} - \text{Total Company Expenses}$

### D. Recording Windows & RBAC Boundaries
- **Company Foundation Boundary (2024):** No operational deliveries, expenses, reports, or spreadsheet imports may precede `2024-01-01`.
- **Admin:** Can do EVERYTHING: full mutation authority across deliveries, trucks, crew, PODs, Excel import, company expenses, and exclusive additional admin features (user management, audited deletion, audit logs, custom templates, and unlimited 2024+ recording).
- **Finance:** Can ONLY edit whatever is on the Finance page (`/finance` — record, edit, and delete company operating expenses). View-only across all other modules (deliveries, trucks, drivers, PODs, user management).
- **Operations:** Dispatch and execution authority (record/edit deliveries within the 3-day window, drop-offs, POD files, truck specs, Excel import), but view-only on Finance and excluded from additional admin features.
- **View-Only Roles** (`hr`, `secretary`, `customerrep`): Can browse and view records, export reports, but cannot mutate deliveries, expenses, trucks, or users. Server-side route guards enforce this.

### E. Pagination & Limit Standards
- Use `<TablePagination />` ([`src/components/table-pagination.tsx`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/table-pagination.tsx)).
- **Dashboard Recent Deliveries:** Strictly **5 records**, fixed without pagination.
- **All Other Tables:** Strictly **10 records per page** (`/deliveries`, `/reports`, `/truck-profitability`, `/pod-documents`, `/drivers`, `/finance`, `/user-management`).

---

## 4. Architectural & Frontend Conventions

### A. Dual-Mode Storage Architecture
1. **Database-Free Preview Mode (Default):**
   - Active when Supabase credentials are absent.
   - Uses `small-mock-database.ts`, in-memory caches, and `localStorage` with custom window events (`ROUTEX_DELIVERIES_CHANGED`, `ROUTEX_COMPANY_EXPENSES_CHANGED`, etc.).
   - Generates deterministic SVG document previews for PODs.
   - **Crucial:** Never break this mode. Any new backend feature or endpoint must provide a clean browser-preview fallback!
2. **Supabase Mode:**
   - Active when `NEXT_PUBLIC_SUPABASE_URL` is set.
   - Connects to PostgreSQL with Row-Level Security (RLS) and private Storage signed URLs.

### B. Styling & Cascade Rules
- **Single Global Stylesheet:** All styles belong in [`src/app/globals.css`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/globals.css).
- **NEVER use CSS Modules (`*.module.css`):** They fail under Next.js 16 Turbopack in this repository.
- **Zero Button Shadows:** Buttons rely on clear semantic backgrounds, borders, and subtle upward hover translation (`translateY(-1.5px)`), never box-shadows.
- Ensure light and dark mode (`html[data-theme="dark"]`) are properly styled.

### C. Layout Shell & Dedicated Pages
- Workspace shell layout (`src/app/(workspace)/layout.tsx`) is the **sole provider** of `<OperationalSidebar />` and `.app-shell`. Child pages should only render `<OperationalTopbar />` and `<div className="content-wrap">`.
- Delivery details view lives on its own dedicated page at [`/deliveries/[id]`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/(workspace)/deliveries/[id]/page.tsx) with a compact `<DeliveryNavigator />`.

---

## 5. Strict Agent Instructions & Guardrails

- **Inspect Existing Code First:** Read and understand current implementation files, tests, and domain functions before making changes.
- **Preserve Existing Functionality:** Do not delete or rewrite working features. Follow the established RouteX design language and conventions.
- **Avoid Overengineering:** Keep implementations clean, direct, and minimal.
- **Never Invent Business Rules:** Refer to the authoritative Knowledge Base in [`docs/knowledge-base/`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/).
- **Strict Git Rule:** **NEVER run `git commit`, `git push`, or deploy without explicit user authorization.**

---

## 6. Authoritative Knowledge Base References

For complete deep-dive documentation, consult the Central Knowledge Base:

- [`docs/knowledge-base/01-project-overview.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/01-project-overview.md) — Mission, scope, boundaries, users.
- [`docs/knowledge-base/02-system-architecture.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/02-system-architecture.md) — Architecture layers & data flows.
- [`docs/knowledge-base/03-technology-stack.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/03-technology-stack.md) — Tech matrix, directory map, tools.
- [`docs/knowledge-base/04-system-modules.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/04-system-modules.md) — Detailed specifications for all 11 modules.
- [`docs/knowledge-base/05-database-documentation.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/05-database-documentation.md) — Schemas, ER diagrams, RLS policies.
- [`docs/knowledge-base/06-business-rules.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/06-business-rules.md) — Financial calculations & operational invariants.
- [`docs/knowledge-base/07-user-roles-and-permissions.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/07-user-roles-and-permissions.md) — 6-role RBAC matrix & access levels.
- [`docs/knowledge-base/08-authentication-and-security.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/08-authentication-and-security.md) — Sessions, Argon2id hashing, recovery.
- [`docs/knowledge-base/09-ui-ux-guidelines.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/09-ui-ux-guidelines.md) — Typography, tokens, pagination, layouts.
- [`docs/knowledge-base/10-api-and-server-logic.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/10-api-and-server-logic.md) — Route Handlers, contracts, audit logs.
- [`docs/knowledge-base/11-file-management.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/11-file-management.md) — Stop-level PODs, private bucket, SVG receipts.
- [`docs/knowledge-base/12-reporting-and-calculations.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/12-reporting-and-calculations.md) — Daily Trip Report, templates, CSV export.
- [`docs/knowledge-base/13-testing-and-quality-assurance.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/13-testing-and-quality-assurance.md) — 16 suites, 222+ tests, test runner.
- [`docs/knowledge-base/14-deployment-and-maintenance.md`](file:///c:/Users/suchi/Documents/rrli/rrliRev/docs/knowledge-base/14-deployment-and-maintenance.md) — Env variables, migrations, troubleshooting.

---

## 7. Test Credentials (Preview Mode)

Sign in at `/login` with password `password123`:
- **Admin:** `admin` (Full superuser access across all modules & admin features)
- **Operations:** `operations` (Dispatch execution, 3-day window; view-only on Finance)
- **Finance:** `finance` (Company expense management on `/finance` only; view-only elsewhere)
- **HR:** `hr` (View-only fleet crew)
- **Secretary:** `secretary` (View-only deliveries & PODs)
- **Customer Rep:** `customerrep` (View-only delivery status)

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
