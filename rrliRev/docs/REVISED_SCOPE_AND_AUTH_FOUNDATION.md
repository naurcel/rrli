# RouteX Revised Scope & Authentication Foundation (`rrliRev`)

## 1. Revised Project Scope Summary

RouteX has been narrowed from a general company-wide management system to focus exclusively on **Delivery Operations and Truck Profitability** for **Redeemed Route Logistics Inc. (RRLI)**:

- **In Scope:**
  - Completed delivery records organized by **Client**, **Delivery Date**, **Waybill Number**, and **Truck**.
  - **Multiple Store Drop-offs** within a single delivery trip (`delivery_dropoffs`), rather than treating every store drop-off as a separate trip.
  - **Itemized Trip Earnings & Expenses** modeled after RRLI's Daily Trip Report (`delivery_rate` vs. `diesel_expenses`, `toll_gate_expenses` + `toll_gate_breakdown`, `entry_fees`, `driver_allowance`, `driver_daily_rate`, `helper_allowance`, `helper_daily_rate`, `other_expenses` → `total_expenses` → `net_income`).
  - **Truck Profitability** analysis (earnings, direct trip expenses, net profit, and margin per truck).
  - **Proof of Delivery (POD) & Supporting Document Verification** across store drop-offs.
  - **Excel Import & Post-Import Review** (staging imported Daily Trip Report spreadsheets for inspection, editing, and validation before saving).
  - **Delivery & Profitability Reports** with print support.
- **Explicitly Excluded / Removed from Revised Scope:**
  - Standalone HR & Payroll modules (`/hr` removed).
  - Standalone company-wide general Finance / Overhead Transactions module (`/transactions` removed).
  - Public self-service user registration (accounts are created and managed exclusively by Admin users).

---

## 2. Three-Tier Role-Based Access Control (RBAC)

Permissions are enforced both in navigation/UI and on the server (`src/proxy.ts`, Server Component layouts, `/api/*` Route Handlers, and PostgreSQL RLS policies in [`supabase/migrations/20261101000000_routex_revised_foundation.sql`](../supabase/migrations/20261101000000_routex_revised_foundation.sql)):

| Role (`public.app_role`) | Access Level | Allowed Capabilities | Restricted Capabilities (Server `403 Forbidden`) |
| :--- | :--- | :--- | :--- |
| **`admin`** (Admin) | `admin` (**Full Access**) | Manage user accounts & assign roles (`/user-management`), create/edit/review deliveries & store drop-offs, import & review Excel files (`/deliveries/import`), verify PODs, access all truck profitability & reports. | Self-lockout (cannot deactivate or remove Admin role from own active session). |
| **`operations`** (Operations) | `operations` (**Operations Write Access**) | Create & manage deliveries, manage multi-store drop-offs, import & review Excel files before saving, verify PODs & supporting documents, view truck profitability & reports. | Cannot access `/user-management` or `/api/users` (`403 Forbidden`). |
| **`finance`** (Finance)<br>**`hr`** (HR)<br>**`secretary`** (Secretary)<br>**`customer_representative`** (Customer Rep) | `view_only` (**View-Only Access**) | View dashboard, completed deliveries, store drop-offs, POD statuses, truck profitability, and operational reports. | Cannot create, edit, import, verify PODs, or delete records (`POST`/`PATCH` to `/api/deliveries`, `/deliveries/import`, and `/api/users` return `403 Forbidden`). |

---

## 3. Daily Trip Report Reference Mapping

Based on RRLI's Daily Trip Report, data is structured into three normalized layers rather than a flat ungrouped table:

1. **Delivery Trip Level (`public.deliveries` / `DeliveryTripRecord`):**
   - `client_id` / `clientName`
   - `delivery_date` / `deliveryDate`
   - `waybill_number` / `waybillNumber`
   - `origin`
   - `distance_km` / `distanceKm`
   - `fuel_rate` / `fuelRate`
   - `delivery_rate` / `deliveryRate` (gross trip revenue)
   - `total_expenses` & `net_income` (derived)
2. **Truck & Crew Trip Costs (`public.trucks` + `TripExpenseBreakdown`):**
   - `plate_number`, `truck_type` (`4-Wheeler`, `6-Wheeler`, `10-Wheeler`), `truck_temperature` (`Frozen`, `Chilled`, `Multi-Temp`, `Ambient`)
   - `diesel_expenses`
   - `toll_gate_expenses` & `toll_gate_breakdown`
   - `driver_daily_rate` & `driver_allowance`
   - `helper_daily_rate` & `helper_allowance`
   - `other_expenses`
3. **Store / Drop-Off Level (`public.delivery_dropoffs` / `DeliveryStoreDropoff`):**
   - `sequence_number` (`1..N` within the trip)
   - `store_name` & `destination_area`
   - `entry_fee`
   - `pod_submitted`, `supporting_docs_complete`, & `documentRef`

---

## 4. Connecting Supabase Auth & PostgreSQL

1. Copy `.env.example` to `.env.local` in `rrliRev/`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```
   *(Security guard: `src/lib/config/env.ts` automatically detects and blocks `service_role` or `sb_secret_` keys if accidentally placed in `NEXT_PUBLIC_*` variables.)*
2. Run the SQL migrations in order in the Supabase SQL Editor:
   1. [`20261101000000_routex_revised_foundation.sql`](../supabase/migrations/20261101000000_routex_revised_foundation.sql) creates profiles, RLS policies, and the initial delivery/profitability tables.
   2. [`20261101010000_stage2_delivery_management.sql`](../supabase/migrations/20261101010000_stage2_delivery_management.sql) adds the database-backed delivery ledger, employees, document handling, activity history, staged import rows, and atomic delivery/POD functions.
3. Provision your initial Admin user in Supabase Authentication and insert their profile row in `public.user_profiles` with `role = 'admin'`.

Current implementation status and limitations are tracked in [`STAGE_2_DELIVERY_MANAGEMENT_PROGRESS.md`](./STAGE_2_DELIVERY_MANAGEMENT_PROGRESS.md).

---

## 5. Open Questions Reserved for Next Stage (Delivery & Excel Import Implementation)

To avoid inventing business rules ahead of Stage 2/3 delivery module build-out, the following items are documented for confirmation before finalizing the Excel parser:
1. **Multi-Store Excel Row Representation:** In the raw Daily Trip Report Excel file, are multiple store drop-offs for a single trip written as multiple rows sharing the same Waybill Number, or as a comma/slash-separated list within the `Destination / Store` cell?
2. **Entry Fee Aggregation:** Are store `Entry Fees` recorded per individual store drop-off or as a single trip-level sum on the Daily Trip Report sheet?
3. **Supporting Document Types:** Besides the signed/stamped Proof of Delivery (POD) slip and Waybill, which specific supporting document types (e.g., cold-chain temperature strip, toll receipts, gate pass) should have dedicated checkboxes in `/pod-documents`?

