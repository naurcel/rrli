# RouteX Current Implementation State

**Verified:** November 2026  
**Authority:** The codebase inside [`rrliRev/`](file:///c:/Users/suchi/Documents/rrli/rrliRev) and its passing automated test suite take precedence over older provisional planning documents.

---

## 1. What RouteX Is Today

RouteX is the internal **Delivery Operations, Multi-Store Drop-offs, POD Documents, and Truck Profitability** system for **Redeemed Route Logistics Inc. (RRLI)**.

It is implemented as a production-ready Next.js 16 application with:
- **Dual-Mode Persistence Architecture:** Operates seamlessly both in **Offline Database-Free Mode** (using `small-mock-database.ts` and `localStorage` with window event synchronization) and in **Connected Mode** (using Supabase PostgreSQL, RLS policies, and Storage buckets).
- **Strict Role-Based Access Control (RBAC):** 6 canonical roles mapped across 3 access levels with Argon2id password hashing and HMAC-SHA256 authenticated sessions.
- **Audited Financial Governance:** Clear separation between `finalized` and `incomplete` deliveries, preventing unknown expenses from corrupting operational revenue totals.
- **Multi-Store Drop-off Tracking:** Granular stop-level route tracking with store addresses, entry fees / gate tolls, and proof-of-delivery (POD) document attachments.
- **Reporting Engine:** 6 built-in templates, custom report designer, Daily Trip Report with dedicated date picker, and Excel-compliant CSV export.
- **Standardized Pagination:** Interactive `<TablePagination />` with page number input, boundary clamping, and standardized page size limits.

---

## 2. Verified Technical Stack

- **Framework:** Next.js 16.4.2 (App Router with Turbopack) & React 19.3.0.
- **Language & Types:** TypeScript 5 with strict mode (`tsc --noEmit` exits with 0 errors).
- **Styling:** Tailwind CSS 4 reset + single authoritative global stylesheet in [`rrliRev/src/app/globals.css`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/globals.css) supporting both light mode and dark mode (`html[data-theme="dark"]`).
- **Database & Storage:** Supabase PostgreSQL with RLS migrations in `rrliRev/supabase/migrations/` + `small-mock-database.ts` offline fallback.
- **Security & Cryptography:** Node's native `crypto` module (HMAC-SHA256 session tokens, timing-safe equality, Argon2id password hashing).
- **Test Runner:** Node.js native test runner (`node --test --experimental-strip-types`) with **171 passing automated tests** across 12 suites.

---

## 3. Implemented Route Inventory & Features

| Route / Surface | Key Capabilities | RBAC Access | Persistence |
| :--- | :--- | :--- | :--- |
| **`/login`** | Split-screen login, username authentication, first-time setup, self-service & admin-assisted password recovery | Public | Server Account Store |
| **`/dashboard`** | Delivery KPIs, revenue trends, top trucks ranking, recent deliveries table (**5 records/page**) with input pagination, detail drawer | All authenticated roles | Dual-mode repository |
| **`/deliveries`** | Deliveries ledger (**10 records/page**), multi-select client/truck dropdown filters, versioned correction modal, audited deletion dialog | View: All roles<br>Mutate: Admin, Operations<br>Delete: Admin only | Dual-mode repository |
| **`/deliveries/new`** | Multi-step delivery wizard, client assignment, truck/crew dispatch, multi-store drop-offs, entry fees, highway tolls, diesel costs | Admin (unrestricted date)<br>Operations (3-day window) | Dual-mode repository |
| **`/deliveries/import`** | Drag-and-drop Excel (`.xlsx`, `.csv`) spreadsheet parser, column mapping, validation preview, batch commitment | Admin, Operations | Dual-mode repository |
| **`/truck-profitability`** | Owned truck performance cards, subcontracted trucks (**10/page**), fleet crew management (**10/page**) with active toggle and registration | View: All roles<br>Mutate: Admin, Operations | Dual-mode repository |
| **`/truck-profitability/[plate]`** | Dedicated truck economics profile, revenue vs expense breakdown, trip history (**10/page**) with input pagination, truck photo upload | View: All roles<br>Mutate: Admin, Operations | Dual-mode repository |
| **`/pod-documents`** | Stop-level POD compliance inspector, status filters (`POD Attached` vs `Missing POD`), inline SVG receipt preview and document download (**10/page**) | View: All roles<br>Mutate: Admin, Operations | Dual-mode storage |
| **`/reports`** | 6 built-in templates (Revenue, Profitability, Activity, Daily Trip Ledger, Client Summary, Truck Summary), customizer modal, Excel CSV export | View: All roles<br>Manage templates: Admin only | Dual-mode repository |
| **`/user-management`** | Authorized personnel list (**10/page**), role assignment, account status toggle, password reset authorization, immutable audit event log (**10/page**) | Admin only | Server Account Store + Audit Logger |
| **`/settings`** | User profile overview, avatar upload with automatic cropping, username and password self-management | All authenticated roles | Server Account Store |

---

## 4. Key Business Logic Invariants

1. **Financial Finalization Policy:**
   - Any delivery trip with `unknown` expenses is marked with `financialState: "incomplete"`.
   - Incomplete deliveries are **strictly excluded** from aggregate revenue, expense, and profit totals in Dashboard, Deliveries, and Reports until finalized.
   - `not_applicable` expenses evaluate to confirmed `null` and do not block finalization.
2. **Delivery Recording Window:**
   - **Admin:** Can record or correct deliveries on **any date** without restriction.
   - **Operations:** Constrained to a **3-day submission window** from the delivery date.
3. **Table Pagination Standards:**
   - Standardized via `<TablePagination />` with direct typed page number input.
   - Dashboard Recent Deliveries: **5 records per page**.
   - All Other Tables: **10 records per page**.
4. **Global Date Filtering:**
   - Default workspace range is **"All Time"** (`startDate: null, endDate: null`).
   - Daily Trip Report on `/reports` has a dedicated fixed single-day picker.

---

## 5. Verification Commands

Always run from `rrliRev/`:

```powershell
cd rrliRev
npm test          # Runs 171 automated tests across 12 suites
npm run typecheck # Strict TypeScript check (0 errors)
npm run build     # Next.js Turbopack production build
npm run dev       # Development server at http://localhost:3000
```
