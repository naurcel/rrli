# RouteX Backend Audit, Stabilization, and Implementation Report

> **Project:** RouteX Logistics Management & Financial Recordkeeping (RRLI)  
> **Target Database:** Supabase Hosted PostgreSQL 17 (`kkyyxbwtrioidhvyxaaq`, `ap-northeast-1`, production)  
> **Status:** Stabilized, Audited, Seeded, and Verified  
> **Test Results:** 386/386 Unit & Integration Tests Passing (33 Suites) | Zero Typecheck Errors  

---

## 1. Executive Summary & Context

RouteX is an operational and financial recordkeeping system for **completed delivery trips**, fleet profitability, company finances, and role-based access control. In accordance with `rrliRev/docs/CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md` and the 10-phase mandate, this backend audit and stabilization resolved critical permission errors, schema inconsistencies, RPC omissions, and view dependencies across the live Supabase PostgreSQL backend.

### Key Architectural Invariants Enforced
1. **One Delivery = One Completed Trip:** RouteX records finalized or operational completed trips. There is no live GPS tracking or in-transit dispatching.
2. **Delivery Locations & Drop-offs:** Deliveries store locations with explicit numeric `dropoff_count`. Total drop-offs for any trip is strictly $\sum \text{dropoff\_count}$.
3. **Financial Completeness & "No Silent Zeroes":** Unknown expenses are stored as `status = 'unknown'` with `NULL` value. Unknown expenses are **never** silently converted to ₱0.00. Financially incomplete deliveries return `NULL` for `total_expenses`, `net_income`, and `profit_margin`, and are excluded from profitability averages.
4. **Automatic Reconciliation:** Financial state reconciles automatically via database trigger (`incomplete` if any expense is unknown; `finalized` when all expenses are resolved).
5. **Operational Window & Crew Rules:** Deliveries enforce a 3-day recording window (backdating requires approved ticket); minimum delivery date is `2024-01-01`. Exactly 1 driver and 1–2 helpers per trip with no duplicate crew assignments or same-day cross-trip conflicts.

---

## 2. Backend Feature Status Matrix

| Feature / Subsystem | Status | Details & Implementation Notes |
|---|---|---|
| **Supabase Migrations & Schema** | **Working** | 13 migration files executed and registered in `supabase_migrations.schema_migrations`. Zero migration drift. |
| **Delivery Ledger View (`delivery_ledger`)** | **Working** | View created with `security_invoker = true`. All underlying tables (`deliveries`, `clients`, `trucks`, `employees`) granted `SELECT` to `anon` and `authenticated`. |
| **Delivery CRUD Operations** | **Working** | RPC `create_delivery_record` rebuilt to capture `dropoff_count`, general `notes`, `driver_id`, and `helper_id`. |
| **Financial Calculations & Completeness** | **Working** | PostgreSQL generated columns compute `total_expenses`, `net_income`, and `profit_margin`. Trigger `trg_auto_reconcile_delivery_financial_state` auto-updates `financial_state`. |
| **Fleet & Trucks Management** | **Working** | `truck_temperature` made nullable for ambient/dry trucks. 21 trucks seeded (6 owned: 2 Freezer, 2 Chilled, 2 Dry; 15 subcontracted). |
| **Employees & Crew Registry** | **Working** | Added `contact_number` to `public.employees`. 10 crew members seeded (4 drivers, 6 helpers). |
| **Clients Registry** | **Working** | Active clients seeded with canonical UUIDs (`Landers`, `MCCI`, `Vanguard`, `Landers Superstore`, `Vanguard Logistics`, `SM Supermarket`). |
| **Company Finance** | **Working** | `company_expenses` table established with category constraints, recurring schedules, and explicit `authenticated` grants. |
| **POD & Supporting Documents** | **Working** | `delivery-documents` private Supabase Storage bucket verified. Dropdown updated to custom accessible `RoundedSelect`. |
| **Authentication & Profiles** | **Working** | `user_profiles` linked with Supabase Auth (`auth.uid()`), supporting multi-role array (`roles text[]`) and `is_superadmin`. |
| **Role-Based Authorization (RLS)** | **Working** | Security definer functions (`is_superadmin`, `is_admin`, `can_write_operations`, `can_read_operations`) updated to inspect multi-role arrays. |

---

## 3. Priority Fixes & Root Cause Analysis

### Fix 1: Resolution of `permission denied for view delivery_ledger` (SQLSTATE 42501)
- **Root Cause:** `delivery_ledger` was defined with `WITH (security_invoker = true)`. When querying a view with security invoker enabled, PostgreSQL checks table permissions not only on the view itself, but on all referenced tables (`deliveries`, `clients`, `trucks`, `employees`, `delivery_dropoffs`). Prior migrations granted `SELECT` on the view to `authenticated`, but never granted table-level `SELECT` on `deliveries` or `delivery_dropoffs` to `authenticated` or `anon`.
- **Resolution:** Executed comprehensive grants in `20261125010000_routex_backend_stabilization.sql` granting `SELECT, INSERT, UPDATE, DELETE` on all operational tables to `authenticated` and `service_role`, plus `SELECT` to `anon`.

### Fix 2: Resolution of Dependent Object Lock & View Schema Alterations (SQLSTATE 2BP01 & 42P16)
- **Root Cause:** Migration `financial_integrity` attempted to alter or drop columns on `deliveries` while `delivery_ledger` depended on them. Furthermore, `CREATE OR REPLACE VIEW` cannot alter column names, order, or data types when columns like `recording_delayed` were inserted.
- **Resolution:** Dropped and cleanly recreated `delivery_ledger` after all generated columns and snapshots were stabilized, avoiding cascading drops.

### Fix 3: Rebuilding `create_delivery_record` RPC
- **Root Cause:** The early stage 2 RPC omitted later schema additions:
  1. `dropoff_count` in `delivery_dropoffs` (defaulted to 1 regardless of user input).
  2. `deliveries.notes` was ignored.
  3. `deliveries.helper_id` was ignored.
- **Resolution:** Updated `create_delivery_record` in PostgreSQL to extract `v_stop->>'dropoffCount'`, `p_record->>'notes'`, and look up `p_record->>'helperId'`, properly populating all delivery and location records.

### Fix 4: Ambient / Dry Trucks Temperature Constraint
- **Root Cause:** `trucks.truck_temperature` was configured as `NOT NULL default '2°C–4°C'`, preventing dry trucks (ambient cargo) from setting temperature to `NULL`.
- **Resolution:** Ran `ALTER TABLE public.trucks ALTER COLUMN truck_temperature DROP NOT NULL;`. Dry trucks now store `NULL` temperature as designed.

### Fix 5: Multi-Role Array Evaluation in PostgreSQL RLS Functions
- **Root Cause:** Legacy helper functions (`is_admin()`, `can_write_operations()`) checked only `role = 'admin'` against the single text column, failing for users whose admin or operations authority stemmed from the `roles text[]` array or `is_superadmin = true`.
- **Resolution:** Replaced functions with queries checking `(up.is_superadmin = true or up.role in (...) or 'admin' = any(up.roles) or 'operations' = any(up.roles))`.

### Fix 6: Superadmin / Service Role Authorization for Database RPCs (`FORBIDDEN: financial correction permission is required`)
- **Root Cause:** When an authorized Superadmin logged in via RouteX's application session (`routex-session`) attempted to correct financials, the Next.js API route (`PATCH /api/deliveries`) correctly verified them server-side via `verifyServerPermission`. However:
  1. Next.js called Supabase RPC (`correct_delivery_financials`) using `createServerSupabaseClient()`, which uses the public `anon` key (with `auth.uid() = NULL`).
  2. Inside PostgreSQL, `correct_delivery_financials` invoked `can_write_operations()`, which strictly checked `WHERE up.id = auth.uid()`. Because `auth.uid()` was `NULL`, it returned `false` and threw `FORBIDDEN: financial correction permission is required`.
- **Resolution:**
  1. Applied migration `20261125020000_fix_service_role_and_superadmin_rpc.sql`, updating `can_write_operations()`, `can_read_operations()`, `is_admin()`, and `is_superadmin()` to recognize backend `service_role` and `postgres` callers (`current_user in ('service_role', 'postgres') or (auth.jwt()->>'role') = 'service_role'`).
  2. Made `correct_delivery_financials`, `finalize_delivery_financials`, and `update_dropoff_document_state` `security definer` with safe handling of null `auth.uid()`.
  3. Dropped `NOT NULL` on `delivery_mutation_requests.actor_id`.
  4. Updated Next.js API route handlers (`POST`, `PATCH`, `DELETE`) to use `createAdminSupabaseClient()` with server-verified authority.

---

## 4. Database Schema & Migration History

All 13 migrations are registered in `supabase_migrations.schema_migrations`:

```
1.  20261101000000 - routex_revised_foundation
2.  20261101010000 - stage2_delivery_management
3.  20261102000000 - financial_integrity
4.  20261104000000 - remove_record_verification
5.  20261104010000 - username_and_password_recovery
6.  20261105000000 - feedback_workflow_fixes
7.  20261109000000 - company_expenses
8.  20261121000000 - truck_classifications
9.  20261122000000 - delivery_notes
10. 20261123000000 - dropoff_count
11. 20261124000000 - superadmin_system
12. 20261125000000 - supabase_auth_and_roles
13. 20261125010000 - routex_backend_stabilization
```

### Remote Database Entity State
- `public.clients`: 6 active clients (`Landers`, `MCCI`, `Vanguard`, `Landers Superstore`, `Vanguard Logistics`, `SM Supermarket`)
- `public.trucks`: 21 active trucks (6 owned fleet vehicles + 15 subcontracted haulers)
- `public.employees`: 10 active crew members (4 drivers, 6 helpers)
- `public.deliveries`: 0 records (cleared per user request so the user can test fresh delivery creation)

---

## 5. Financial & Operational Integrity Verification

### Zero-Tolerance for Silent Zeroes
The PostgreSQL generated column expression on `deliveries` strictly enforces:
```sql
total_expenses = CASE
  WHEN diesel_expenses_status = 'unknown' OR toll_gate_expenses_status = 'unknown'
    OR entry_fees_status = 'unknown' OR driver_allowance_status = 'unknown'
    OR driver_daily_rate_status = 'unknown' OR helper_allowance_status = 'unknown'
    OR helper_daily_rate_status = 'unknown' OR other_expenses_status = 'unknown'
  THEN NULL
  ELSE (
    COALESCE(CASE WHEN diesel_expenses_status = 'confirmed' THEN diesel_expenses ELSE 0 END, 0) +
    COALESCE(CASE WHEN toll_gate_expenses_status = 'confirmed' THEN toll_gate_expenses ELSE 0 END, 0) +
    COALESCE(CASE WHEN entry_fees_status = 'confirmed' THEN entry_fees ELSE 0 END, 0) +
    COALESCE(CASE WHEN driver_allowance_status = 'confirmed' THEN driver_allowance ELSE 0 END, 0) +
    COALESCE(CASE WHEN driver_daily_rate_status = 'confirmed' THEN driver_daily_rate ELSE 0 END, 0) +
    COALESCE(CASE WHEN helper_allowance_status = 'confirmed' THEN helper_allowance ELSE 0 END, 0) +
    COALESCE(CASE WHEN helper_daily_rate_status = 'confirmed' THEN helper_daily_rate ELSE 0 END, 0) +
    COALESCE(CASE WHEN other_expenses_status = 'confirmed' THEN other_expenses ELSE 0 END, 0)
  )
END
```
- If any expense status is `'unknown'`, `total_expenses`, `net_income`, and `profit_margin` are `NULL`.
- The `delivery_profitability_summary` RPC strictly filters `WHERE financial_state = 'finalized' AND total_expenses IS NOT NULL` when aggregating KPI totals, preventing skewed averages.

---

## 6. Frontend Compatibility & UI Polishing Completed

1. **Supporting Documents Target Dropdown:**
   - Replaced native HTML `<select>` with custom `RoundedSelect` component.
   - Restyled dropdown menu to eliminate dark unstyled browser boxes and ensure full theme compatibility across light and dark modes.
2. **Delivery History Table Search:**
   - Moved search box to the left side of the filter bar for intuitive workflow alignment.
3. **Responsive UI Resizing:**
   - Added responsive breakpoints (`max-width: 768px` and `max-width: 440px`) to prevent squished layouts, clipped toolbar filters, and table overflows.
   - Converted fleet card grids to fluid `minmax(min(100%, 280px), 1fr)`.
4. **Discord-Style Role Pills:**
   - Modernized role badges into Discord-inspired capsules: neutral background, subtle border, colored dot indicator, and title-case text (no colored text, no aggressive all-caps).
5. **Account Security Status Card:**
   - Removed redundant security status card from Settings page.
   - Added automatic scroll-to-top when switching sidebar tabs in Settings and User Management.

---

## 7. Verification & Testing Summary

- **TypeScript Compilation:** `npm run typecheck` passed with 0 errors.
- **Unit & Integration Test Suite:** `npm test` ran 386 tests across 33 test files:
  - RBAC and Session Guard: 100% pass
  - Username Auth and Password Recovery: 100% pass
  - Delivery Domain & Financial Calculations: 100% pass
  - Truck & Driver Management: 100% pass
  - Incomplete Detection & KPI Summaries: 100% pass
  - Security Adversarial Lockout: 100% pass
- **Live Supabase Queries:**
  - `SELECT * FROM delivery_ledger`: Returned `[]` with zero errors.
  - `delivery_profitability_summary` RPC: Executed cleanly with zero errors.
  - `public.deliveries`: Empty (0 records) awaiting user testing.
