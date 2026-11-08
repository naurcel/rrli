<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->

---

# RouteX: AI Agent & Developer Operating Manual

> **FOR ALL AI AGENTS & DEVELOPERS:**  
> This section is the authoritative specification for RouteX. Read this before writing, modifying, or testing code in this repository.

## 1. Project Overview & Active Codebase

RouteX is the internal **Delivery Operations, Multi-Store Drop-offs, POD Documents, and Truck Profitability** system for **Redeemed Route Logistics Inc. (RRLI)**.

- **Active Workspace Directory:** All application code lives inside [`rrliRev/`](file:///c:/Users/suchi/Documents/rrli/rrliRev).
- **Never create parallel directories** at the repository root. Always work inside `rrliRev/`.
- **Command Working Directory:** Always execute npm commands from `rrliRev/`:
  ```powershell
  cd rrliRev
  npm test
  npm run typecheck
  npm run build
  npm run dev
  ```

---

## 2. Verification Gates (Strict Requirements)

Before submitting any turn or code change, run and verify:

1. **Unit & Integration Tests (100% Pass Rate Required):**
   ```powershell
   cd rrliRev; npm test
   ```
   Uses Node's built-in test runner (`node --test --experimental-strip-types`). All 171+ tests across 12 suites must pass without errors or skipped tests.
2. **TypeScript Strict Typecheck (Zero Errors Required):**
   ```powershell
   cd rrliRev; npm run typecheck
   ```
   Must exit with code 0 (`tsc --noEmit`).
3. **Next.js Production Build:**
   ```powershell
   cd rrliRev; npm run build
   ```
   Next.js Turbopack must compile all routes cleanly.

---

## 3. Core Business Rules & Invariants

Always uphold these domain invariants:

### A. Canonical Terminology
- **"Delivery Revenue"** (Never use "rate", "billing", "gross revenue", or "sales").
- **"Trip Expenses"** = Diesel Fuel + Highway Tolls + Store Entry Fees + Crew Compensation + Other Expenses (Never use "operational costs" or "fleet overhead").
- **"Store Drop-offs"** (Never use "stops", "waypoints", or "drops").
- **"Net Profit"** & **"Profit Margin"** (`(Net Profit / Delivery Revenue) * 100`).
- **"POD Attached"** vs. **"Missing POD"** (Never use "Verified" / "Pending Verification").

### B. Financial Integrity & Calculation Rules
- **Deliveries with `unknown` expenses are marked `incomplete`.**
- Deliveries in the `incomplete` financial state **MUST BE EXCLUDED** from aggregate revenue, expense, and profit KPI totals until they are finalized with confirmed expenses.
- Never silently zero an unknown expense!
- `not_applicable` expenses evaluate to confirmed `null` with `0` impact and do not block finalization.
- Under Truck Profitability, unfinalized delivery revenue may be displayed as a distinct `+ ₱X pending` indicator, but must remain separate from finalized revenue.

### C. Delivery Recording Window & RBAC
- **Admin**: Can record or edit deliveries with **no date range limitation** (any past or future date).
- **Operations**: Subject to a **3-day submission window** from the delivery date.
- **View-Only Roles** (Finance, HR, Secretary, Customer Representative): Can browse and view records, export reports, but cannot mutate deliveries, trucks, or users.

### D. Table Pagination & Limit Standards
- Use the shared `<TablePagination />` component ([`src/components/table-pagination.tsx`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/table-pagination.tsx)).
- Supports direct typed page number input (`Page [ 1 ] of X`), Enter key, onBlur, boundary clamping, and Prev/Next buttons.
- **Page size rules:**
  - **Dashboard Recent Deliveries:** Strictly **5 records per page**.
  - **All Other Tables:** Strictly **10 records per page** (`/deliveries`, `/reports`, `/truck-profitability/[plate]`, `/pod-documents`, `/truck-profitability`, `/user-management`).

### E. Date Range Filtering
- The global date range picker ([`GlobalDateRangePicker`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/global-date-range-picker.tsx)) defaults to **"All Time"** (`startDate: null, endDate: null`).
- Exception: The **Daily Trip Report** on `/reports` is locked to a specific single date selector and operates independently of the global date range.

---

## 4. Architectural & Frontend Conventions

### A. Dual-Mode Storage Architecture
RouteX operates seamlessly in two environments:
1. **Database-Free Preview Mode** (when Supabase credentials are absent):
   - Uses `small-mock-database.ts`, in-memory caches, and `localStorage` with custom browser events (`ROUTEX_DELIVERIES_CHANGED`, `BROWSER_PREVIEW_TRUCKS_CHANGED`, etc.).
   - Generates deterministic SVG document previews for PODs.
   - **Crucial:** Never break this mode. Any new backend feature or endpoint must provide a clean browser-preview fallback!
2. **Supabase Mode** (when `NEXT_PUBLIC_SUPABASE_URL` is set):
   - Uses PostgreSQL repository with Row-Level Security (RLS) and Supabase Storage signed URLs.

### B. Styling & Cascade Rules
- **Single Global Stylesheet:** All styles belong in [`rrliRev/src/app/globals.css`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/globals.css).
- **NEVER use CSS Modules (`*.module.css`):** They fail under Next.js 16 Turbopack in this repository.
- Avoid massive inline Tailwind chains; use semantic RouteX design classes (`.records-card`, `.stat-card`, `.primary-action-button`, `.secondary-button`, `.filter-button`, `.rounded-select`, etc.).
- Ensure both light mode and dark mode (`html[data-theme="dark"]`) are styled properly.

### C. Reusable UI Components
Always reuse the established components in `src/components/`:
- `<OperationalSidebar />` & `<OperationalTopbar />` — Workspace layout shell.
- `<GlobalDateRangePicker />` — Workspace date filter.
- `<TablePagination />` — Page input pagination.
- `<RoundedSelect />` — Dropdown select primitive.
- `<DeliveryFilterDropdown />` & `<TruckFilterDropdown />` — Multi-select filters.
- `<DeliveryDropoffTimeline />` — Store drop-off sequence and POD status cards.
- `<DeliveryFinancialBreakdown />` & `<AggregateExpenseBreakdown />` — Financial attribution.
- `<DeliveryPodDocuments />` — Stop-level document upload and viewing.
- `<RecordDetailDrawer />` — Slide-over details inspector.
- `<ConfirmDeliveryDeletionDialog />` & `<ConfirmTruckDeletionDialog />` — Audited administrative deletion dialogs.

---

## 5. Test Credentials & Demo Accounts

When testing in local preview mode, sign in at `/login` using any of these seeded credentials:

| Role | Username | Access Level | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | Full System Management | Full access, user management, audit logs, unlimited delivery date recording, record deletion |
| **Operations** | `operations` | Dispatch & Execution | Record deliveries (3-day window), fleet management, POD documents, Excel import |
| **Finance** | `finance` | View-Only | View all records, financial breakdowns, reports, CSV export |
| **HR** | `hr` | View-Only | View fleet crew (drivers/helpers), reports |
| **Secretary** | `secretary` | View-Only | View deliveries, drop-offs, POD documents |
| **Customer Rep** | `customerrep` | View-Only | View delivery status and client drop-offs |

Password for all seeded preview accounts: `password123` or direct sign-in button.

