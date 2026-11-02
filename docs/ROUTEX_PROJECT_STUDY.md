# RouteX: Comprehensive Project Study and Context Reconstruction

**Project:** RouteX — Profitability Analysis System  
**Client / Beneficiary:** Redeemed Route Logistics Inc. (RRLI)  
**Repository:** `c:\Users\suchi\Documents\rrli`  
**Study Date:** October 30, 2026  
**Prepared By:** Senior Software Architect & Codebase Investigator (Antigravity)  
**Investigation Mode:** Read-Only Forensic Audit (Codebase + Git History + Knowledge Base + Codex Development Kit + Local Codex IDE Rollout Logs)

---

> **Current-state update — 2026-10-30:** This forensic study captures the
> repository at the point it was written. The then-reported deleted
> `/deliveries` route has since been restored in the active working tree and
> the current UI includes local create flows, a fleet profile/photo flow,
> administration audit UI, date-aware dashboard/report views, and the hosted
> temporary preview gate. Use [Current Implementation State](CURRENT_IMPLEMENTATION_STATE.md)
> for live implementation status; retain this study for its source and
> conflict analysis.

---

## 1. Executive Summary

**RouteX** is an internal web-based **Profitability Analysis System** being developed for **Redeemed Route Logistics Inc. (RRLI)**, a Philippine trucking and freight forwarding operator. Its primary business objective is to replace fragmented spreadsheets and manual paper logs with a centralized, auditable operational and financial ledger that establishes an unbroken traceability chain:

$$\text{Company Net Result} \longrightarrow \text{Truck Contribution} \longrightarrow \text{Completed Delivery Margin} \longrightarrow \text{Source Financial & Document Records}$$

A core architectural invariant of RouteX is **preventing expense double-counting**: delivery-attributable expenses (fuel, tolls, helper fees, cash advances) must be separated from company-level operating overhead (rent, utilities, general maintenance, staff compensation summaries), while preserving historical integrity via void/reversal/correction workflows rather than destructive deletion.

### Current Project State at a Glance

| Dimension | Actual Verified Status | Classification |
| :--- | :--- | :--- |
| **Application Stage** | High-craft **Frontend Interactive Prototype / UI Preview** with client-side fixtures and `localStorage` persistence. Zero live database tables, migrations, server actions, or file storage buckets exist yet. | `Implemented` (UI Preview) / `Unresolved` (Backend) |
| **Actual Tech Stack** | **Next.js `16.4.2`** (App Router, Turbopack, `reactCompiler: true`, `cacheComponents: true`), **React `19.3.0`**, **TypeScript `5`**, **Tailwind CSS `v4`**, **`@supabase/supabase-js` `^2.118.0`**, **`@supabase/ssr` `^0.12.7`**, **`zod` `^4.6.7`**, Node native test runner (`node --test`). | `Implemented` |
| **Documented Stack Drift** | Knowledge Base (`ADR-002`, `Tech-Stack.md`) and Kit (`02-architecture-and-repository.md`) claim Next.js 15, Auth.js / NextAuth, `shadcn/ui`, and `lucide-react`. **None of Auth.js, shadcn/ui, or Lucide are installed.** `RouteX Architecture Blueprint v1.md` explicitly supersedes Auth.js in favor of Supabase Auth. | `Confirmed` (Code + Blueprint supersede older docs) |
| **Authentication & Route Protection** | 3-mode gate (`src/proxy.ts` + `src/features/auth/auth-model.ts`): (1) `supabase` mode if public env vars are set; (2) `preview` mode in local `development` (one-click entry); (3) `preview-login` mode in hosted builds without Supabase (`admin` / `admin` via `/api/preview-session` setting static cookie `routex-preview-session=routex-preview-ui-v1`). **Zero RBAC enforcement exists.** | `Implemented` (Preview Gate) / `Blocked` (RBAC) |
| **Database & Persistence** | Only client/server/proxy Supabase Auth helpers exist (`src/lib/supabase/`). No `supabase/migrations/`, no SQL schema, no RLS policies, no database queries. User-created trucks (`/fleet/new`), deliveries (`/deliveries/new`), transactions (`/transactions/new`), and cropped truck photos live solely in browser `localStorage`. | `Proposed` (Blueprint) / `Blocked` (Domain Rules) |
| **Working Tree Health** | **CRITICAL REGRESSION:** `src/app/deliveries/page.tsx` is currently **deleted (`D`)** in the uncommitted working tree following an interrupted Codex edit at `2026-10-29T15:23:57Z`. As a result, `/deliveries` will 404 and **`npx tsc --noEmit` currently fails** (`TS2307: Cannot find module '../../src/app/deliveries/page.js'`). Unit tests (`npm test`) pass (`28/28`). | `Implemented` (With Active Regression) |
| **Domain Governance** | 6 confirmed ADRs (`ADR-001` to `ADR-006`) and 13 access/feature clarifications (`ACL-01` to `ACL-13`) lock in **completed-deliveries-only** scope, **no live GPS/dispatch**, **no hard deletes**, **6 canonical roles**, and **example-only status for `₱500/hr`**. However, **14+ blocking domain decisions** (`D-002` to `D-018`, `KB-001` to `KB-007`) remain unresolved. | `Confirmed` (Core Boundaries) / `Blocked` (Formulas & RBAC Matrix) |

---

## 2. Project Purpose and Business Context

### 2.1 Operational Problem & Intended Outcome
Redeemed Route Logistics Inc. (RRLI) operates company-owned trucks (`4-wheeler`, `6-wheeler`, `10-wheeler`) and engages subcontracted partner trucks to fulfill B2B freight deliveries across Luzon/Metro Manila. Prior to RouteX, RRLI tracked completed trips, proof-of-delivery (POD) documents, fuel/toll receipts, subcontracted billing, and company operating expenses across disconnected spreadsheets and physical folders. This caused:
1. **Delayed and error-prone profitability visibility** per delivery, per truck, and across the company.
2. **Risk of double-counting expenses** when delivery-direct expenses and company-wide operating expenses were aggregated without strict boundary rules (`RouteX-Knowledge-Base/00-Project-Core/Problem-Statement-and-Objectives.md`, `ADR-005`).
3. **Lack of auditability** when historical figures were edited or deleted in spreadsheets without an immutable change log (`ADR-006`).
4. **Delayed billing readiness** due to missing visibility into whether a completed delivery has an attached POD document (`01-Requirements/POD-and-Document-Handling.md`).

### 2.2 Project Team & Timeline
- **Client / Beneficiary:** Redeemed Route Logistics Inc. (RRLI) (`00-Project-Core/Project-Overview.md`).
- **Academic / Delivery Team:**
  - **Louiza Joy C. Beñares** — Project Manager (`00-Project-Core/Team-and-Responsibilities.md`).
  - **Jelene C. Punongbayan** — System Analyst (`00-Project-Core/Team-and-Responsibilities.md`).
  - **Marc Rancel R. Bongalos** — Tester / Developer (listed as Tester/Developer in SRS and QA/Testing in Proposal; `KB-018`).
- **Key Milestones (`00-Project-Core/Project-Timeline-and-Deliverables.md`):**
  - **August 10, 2026:** Project start.
  - **October 15, 2026:** Letter of Acceptance (LOA) signed.
  - **October 19, 2026:** Active system development started.
  - **October 19 – November 23, 2026:** Core module development window.
  - **December 4, 2026:** Target project completion and handover.
  - **Post-Acceptance Support:** **1 month** after formal acceptance (`Confirmed` by user clarification in `KB-019` and `D-015`, superseding garbled 6-month wording in the scanned LOA).

### 2.3 Intended Users, Canonical Roles, and Permissions
Per `ADR-004`, `ACL-01`, and `01-Requirements/Roles-and-Permissions.md`, RouteX defines **six canonical roles** (`Confirmed`):
1. **`Admin`:** Manages user accounts, role assignments, activation/deactivation, and system administration. **Crucial Rule (`ACL-02`, `ADR-004`):** `Admin` does **not** automatically receive permission to create or edit financial or operational records unless explicitly granted by an approved role rule.
2. **`President`:** Executive oversight; views company-wide profitability, truck rankings, financial summaries, reports, and audit logs.
3. **`Corporate Secretary`:** Executive/corporate role included in the 6 canonical roles (`ACL-01`), but **exact view vs. edit permissions are unresolved (`Blocked`: `D-013`, `KB-005`)**.
4. **`Operations`:** Records and maintains completed deliveries, truck assignments, POD statuses/attachments, and **can also edit delivery financial entries** (`ACL-03` — both Operations and Finance may edit delivery financial entries, subject to final role matrix).
5. **`Finance`:** Manages delivery financial entries, company operating expenses, financial verification/reconciliation, and financial reports/exports.
6. **`HR`:** Manages employee records (drivers/staff) and **high-level compensation summaries only** (`ACL-10` — not a full payroll/tax/statutory-deduction engine).

### 2.4 First-Release Scope vs. Explicit Exclusions
Per `00-Project-Core/Scope-and-Exclusions.md`, `ADR-001`, `ACL-04`, `ACL-05`, `ACL-10`, and `ACL-12`:
- **In Scope (First Release — `Confirmed`):**
  - Recording **completed deliveries only** (post-delivery operational & financial recordkeeping).
  - Recording delivery revenue and delivery-attributable expenses to compute derived delivery margin.
  - Tracking POD attachment status (`Attached` vs. `Missing`) and supporting POD file upload/viewing once storage rules are finalized.
  - Managing **Owned trucks** (`4-wheeler`, `6-wheeler`, `10-wheeler` — `ACL-11`) and **Subcontracted trucks** (grouped by subcontractor company).
  - Recording company-level operating expenses separately from delivery expenses (`ADR-005`).
  - Recording HR compensation summaries (`ACL-10`).
  - Generating date-filtered profitability, revenue, expense, and operations reports with print/export capabilities.
  - Maintaining an immutable **Audit Trail** for creation, edits, status transitions, and void/reversal/correction events (`ADR-006`).
- **Out of Scope / Explicitly Excluded (`Confirmed`):**
  - **No live dispatch, route optimization, or real-time GPS tracking** (`ADR-001`, `ACL-04`).
  - **No in-transit delivery lifecycle workflow** (`Pending`, `In Transit`, `Delayed` are legacy prototype artifacts and must not drive core workflow; `ACL-04`, `KB-016`).
  - **No automated time-window penalty calculation** from prototype timing fields (`Call Time`, `ETA`, `Start Loading`, `End Loading`, `Departure`; `ACL-05`, `KB-017`).
  - **No automatic CSV/Excel/legacy data import in v1** (`Scope-and-Exclusions.md`, `ACL-12`, `07-data-imports.md`).
  - **No full payroll system** (no government tax tables, SSS/PhilHealth/Pag-IBIG computation, or payslip generation; `ACL-10`).
  - **No direct customer portal or automated client invoicing** (`Scope-and-Exclusions.md`).

---

## 3. Sources Examined and Access Limitations

### 3.1 Sources Examined in Full
1. **RouteX Project Workspace (`c:\Users\suchi\Documents\rrli`):**
   - Root configs & manifests: [package.json](file:///c:/Users/suchi/Documents/rrli/package.json), [next.config.ts](file:///c:/Users/suchi/Documents/rrli/next.config.ts), [tsconfig.json](file:///c:/Users/suchi/Documents/rrli/tsconfig.json), [.env.example](file:///c:/Users/suchi/Documents/rrli/.env.example), [README.md](file:///c:/Users/suchi/Documents/rrli/README.md), [AGENTS.md](file:///c:/Users/suchi/Documents/rrli/AGENTS.md).
   - Root architecture proposal: [RouteX Architecture Blueprint v1.md](file:///c:/Users/suchi/Documents/rrli/RouteX%20Architecture%20Blueprint%20v1.md) (763 lines).
   - All application source files and tests under `src/` (39 `.ts`/`.tsx` files + [globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css)).
   - Git commit log (`a28030f` through `d7088f4`) and uncommitted working tree status (`git status --short`).
2. **RouteX Knowledge Base (`c:\Users\suchi\Documents\rrli\RouteX-Knowledge-Base`):**
   - `00-Project-Core/` (5 files), `01-Requirements/` (9 files), `02-Architecture/` (5 files), `03-Design/` (3 files), `04-Development/` (2 files), `06-Decisions/` (`ADR-001` through `ADR-006`), `07-AI-Agents/Source-Authority-and-Conflict-Handling.md`, `08-Logs/Issues-and-TODOs.md` (`KB-001` to `KB-025`), `09-References/Source-Index.md`, and `09-References/Canonical-Documents/Working-References/RouteX_Feature_Spec_and_Access_Control.md` (`ACL-01` to `ACL-13`).
3. **RouteX Codex Development Kit (`c:\Users\suchi\Documents\rrli\RouteX_Codex_Development_Kit`):**
   - [AGENTS.md](file:///c:/Users/suchi/Documents/rrli/RouteX_Codex_Development_Kit/AGENTS.md), `docs/00-project-brief.md` through `docs/16-codebase-study-2026-10-26.md` (including `12-decisions-and-open-questions.md` `D-001`–`D-020` and `13-progress-and-handoff.md`), all 9 module specs (`docs/modules/01`–`09`), and engineering loop reports (`docs/reports/17`–`31`).
4. **Local Codex IDE Extension Conversation History (`C:\Users\suchi\.codex`):**
   - Inspected `C:\Users\suchi\.codex\session_index.jsonl` (19 indexed threads) and `C:\Users\suchi\.codex\sessions\2026\10\...` (20 `.jsonl` rollout transcripts).
   - Extracted and audited user/assistant turns from the primary 462 MB RouteX build session (`rollout-2026-10-23T20-12-42-01a16876-8e64-7f13-85ab-0ee2a05351a0.jsonl`, spanning October 23 to October 30, 2026 `00:31` local time).

### 3.2 Access Limitations & Unavailable Sources
- **External Legacy Prototype HTML (`C:\Users\suchi\Documents\RouteX\RtX_-prototype-z.html`):** Referenced in early Oct 23 Codex transcripts and `03-Design/Screen-Inventory.md`, located outside the `c:\Users\suchi\Documents\rrli` workspace. Not directly read to respect workspace boundaries, though its exact screen inventory and conflicts are thoroughly documented in `03-Design/Screen-Inventory.md` and `KB-016`/`KB-017`.
- **Remote Cloud Environments (Supabase & Vercel):** No `.env.local` exists in the workspace (verified safely without exposing secrets), so no live Supabase project or Vercel deployment dashboard was queried.
- **Original Binary Artifacts in `Canonical-Documents/Original-Binaries/`:** The `.docx`, `.pdf`, and `.zip` files under `09-References/Canonical-Documents/` were not parsed as raw binaries because their complete extracted Markdown equivalents and conflict logs (`Source-Index.md`, `Issues-and-TODOs.md`, `RouteX_Feature_Spec_and_Access_Control.md`) are already maintained inside `RouteX-Knowledge-Base`.

---

## 4. Current Technology Stack

The table below contrasts what is **actually installed and active in code** against what older project documents claim:

| Layer / Capability | Verified Live Implementation (`package.json` / `src/`) | Claimed in Older Docs (`KB` / `DevKit`) | Status & Authority |
| :--- | :--- | :--- | :--- |
| **Framework** | **Next.js `16.4.2`** (App Router, Turbopack, `src/proxy.ts` convention) | Next.js 15+ (App Router) | `Implemented` — Code is authoritative (`package.json`). |
| **UI Runtime** | **React `19.3.0`** & **`react-dom` `19.3.0`** with `babel-plugin-react-compiler` `1.0.0` | React 19 | `Implemented` — React Compiler enabled in `next.config.ts`. |
| **Next.js Flags** | `reactCompiler: true`, `cacheComponents: true`, `experimental.partialPrefetching: true`, `experimental.agentFeedback: true` | Not mentioned in KB/DevKit | `Implemented` in [next.config.ts](file:///c:/Users/suchi/Documents/rrli/next.config.ts#L3-L10). |
| **Language** | **TypeScript `^5`** (`strict: true`, `target: ES2017`, `moduleResolution: bundler`) | TypeScript | `Implemented` in [tsconfig.json](file:///c:/Users/suchi/Documents/rrli/tsconfig.json). |
| **Styling** | **Tailwind CSS `^4`** (`@tailwindcss/turbopack`) + **605-line custom CSS design system** in [globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css) | Tailwind CSS + `shadcn/ui` + `lucide-react` | `Implemented` — **No `shadcn/ui` and no `lucide-react` installed**; custom hand-crafted SVG icons and bespoke CSS classes are used instead. |
| **Auth & Backend SDK** | **`@supabase/supabase-js` `^2.118.0`** + **`@supabase/ssr` `^0.12.7`** | Auth.js (NextAuth) + Supabase PostgreSQL (`ADR-002`) | `Provisional` / `Implemented` (SDK) — `RouteX Architecture Blueprint v1.md` supersedes `ADR-002` by selecting **Supabase Auth** over Auth.js. |
| **Validation** | **`zod` `^4.6.7`** + **`server-only` `^0.0.1`** | Zod | `Implemented` in [env.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/config/env.ts) and [auth-model.ts](file:///c:/Users/suchi/Documents/rrli/src/features/auth/auth-model.ts). |
| **Testing** | **Node.js built-in test runner** (`node --test --experimental-strip-types`) | Unit + integration + UAT | `Implemented` — 11 `.test.ts` suites (28 tests passing). |
| **Environment Variables** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plus runtime `NODE_ENV`) | Same + server secret keys (not yet added) | `Implemented` in [.env.example](file:///c:/Users/suchi/Documents/rrli/.env.example) and [env.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/config/env.ts). |

---

## 5. Existing Architecture

### 5.1 Repository Layout & Layering
The live codebase uses a hybrid Next.js App Router + feature-sliced structure under `src/`:
- **`src/app/` (Routes & App Shell):**
  - [layout.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/layout.tsx): Root HTML shell loading Google Font `Readex Pro`, injecting a synchronous inline theme-initialization script (`localStorage.getItem("routex-theme")`), and wrapping the tree in [`GlobalDateRangeProvider`](file:///c:/Users/suchi/Documents/rrli/src/components/global-date-range.tsx).
  - [template.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/template.tsx): Wraps route children in `<div className="route-template">` for CSS entry animations.
  - [error.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/error.tsx) & [not-found.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/not-found.tsx): Error boundary and 404 fallback UI.
  - Route directories: `/login`, `/dashboard`, `/deliveries` (currently missing `page.tsx`, has `/deliveries/new`), `/fleet` (`/fleet/new`, `/fleet/[truckId]`), `/transactions` (`/transactions/new`), `/reports`, `/administration` (`/administration/audit-trail`), `/settings`, and `/api/preview-session`.
- **`src/proxy.ts` (Next.js 16 Request Proxy / Middleware):**
  - Intercepts all non-static requests (`matcher` excludes `_next/static`, `_next/image`, `favicon.ico`, and image extensions).
  - Evaluates [`isPublicRoute(pathname)`](file:///c:/Users/suchi/Documents/rrli/src/lib/auth/route-policy.ts#L10-L15) (only `/login` and `/api/preview-session` are public).
  - Checks [`getAuthenticationMode()`](file:///c:/Users/suchi/Documents/rrli/src/features/auth/auth-model.ts#L22-L33):
    - In `preview` mode (`NODE_ENV === "development"` without Supabase config): passes all requests through.
    - In `preview-login` mode (`NODE_ENV !== "development"` without Supabase config): checks for cookie `routex-preview-session === "routex-preview-ui-v1"`; if missing, redirects to `/login?next=<sanitized-path>`. If authenticated and visiting `/login`, redirects to `/dashboard`.
    - In `supabase` mode: invokes [`updateSupabaseSession(request)`](file:///c:/Users/suchi/Documents/rrli/src/lib/supabase/proxy.ts#L15-L71), which creates a `@supabase/ssr` server client, calls `supabase.auth.getClaims()`, redirects unauthenticated users on protected routes to `/login?next=...`, redirects authenticated users on `/login` to `/dashboard`, and copies refreshed auth cookies onto the response.
- **`src/components/` (Shared Shell & Interactive Controls):**
  - [`OperationalSidebar`](file:///c:/Users/suchi/Documents/rrli/src/components/operational-sidebar.tsx) + [`sidebar-state-model.ts`](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state-model.ts): Resizable (`188px`–`320px`, default `248px`) and collapsible (`76px` rail, collapse threshold `136px`) sticky left navigation with pointer drag handle, keyboard arrow resize/collapse, and `localStorage` persistence (`routex-sidebar-state`).
  - [`OperationalTopbar`](file:///c:/Users/suchi/Documents/rrli/src/components/operational-topbar.tsx): Sticky glass topbar with an accessible custom calendar range popover (`Today`, `Last 7 days`, `Last 30 days`, `All dates`, plus two-click custom start/end date selection and full keyboard grid navigation), theme toggle, and preview status pill.
  - [`GlobalDateRangeProvider`](file:///c:/Users/suchi/Documents/rrli/src/components/global-date-range.tsx): React context sharing the active date window (defaulting to `2026-10-16` through `2026-10-29`, `"Last 14 days"`) across Dashboard, Deliveries, Transactions, and Reports.
  - [`RecordDetailDrawer`](file:///c:/Users/suchi/Documents/rrli/src/components/record-detail-drawer.tsx): Right-hand workspace column (`400px` wide) that pushes `.main-content` left via `body.record-detail-open` rather than dimming the sidebar with a modal backdrop.
  - [`RoundedSelect`](file:///c:/Users/suchi/Documents/rrli/src/components/rounded-select.tsx) & [`SortableTableHeader`](file:///c:/Users/suchi/Documents/rrli/src/components/sortable-table-header.tsx): Accessible custom listbox and 3-state column sorter (`asc` → `desc` → `default`).
  - [`TruckProfilePage`](file:///c:/Users/suchi/Documents/rrli/src/components/truck-profile-page.tsx) & [`TruckPhotoManager`](file:///c:/Users/suchi/Documents/rrli/src/components/truck-photo-manager.tsx): Shared truck profile renderer and HTML5 canvas drag/zoom cropper (`1200x760` JPEG `0.86`).
- **`src/features/` (Domain Fixtures & Pure View-Models):**
  - `auth/`, `dashboard/`, `deliveries/`, `fleet/`, `transactions/`, `reports/`, `audit/`.
- **`src/lib/` (Infrastructure Primitives):**
  - `auth/` (`preview-session.ts`, `route-policy.ts`), `config/` (`env.ts`), `errors/` (`app-error.ts`), `preview/` (`format.ts`), `supabase/` (`browser.ts`, `server.ts`, `proxy.ts`).

### 5.2 Current Request & Data Flow
1. **Zero Database Roundtrips:** No page, component, or API route queries PostgreSQL or Supabase Storage.
2. **Static Fixtures + Disconnected Browser Storage:**
   - Static TypeScript arrays inside `src/features/*` provide baseline preview records.
   - Four `localStorage` keys store user-created preview data in the browser:
     - `routex-created-delivery-preview` ([delivery-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/deliveries/delivery-local-preview.ts#L19))
     - `routex-created-transaction-preview` ([transaction-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/transactions/transaction-local-preview.ts#L19))
     - `routex-created-fleet-preview` ([fleet-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.ts#L28))
     - `routex-preview-truck-photo:${truckId}` ([truck-photo-manager.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/truck-photo-manager.tsx#L21))

---

## 6. Intended Architecture

### 6.1 Authoritative Target Architecture (`RouteX-Knowledge-Base` + `RouteX Architecture Blueprint v1.md`)
The intended production architecture is a **modular monolith built on Next.js App Router + Supabase (PostgreSQL, Supabase Auth, Supabase Storage)** deployed to **Vercel**:

```
Browser Client (Next.js App Router UI)
   │
   ├──► src/proxy.ts (Session Refresh & Route Gate via @supabase/ssr)
   │
   ├──► Server Components (Read-only Queries via Server Supabase Client + RLS)
   │
   └──► Server Actions / Route Handlers (Mutations)
           │
           ├─ 1. Authenticate session (Supabase Auth getUser / getClaims)
           ├─ 2. Authorize canonical role (RBAC policy check against user_profiles)
           ├─ 3. Validate payload (Zod schema validation)
           ├─ 4. Enforce domain invariants (Completed-only, no double-counting, no hard delete)
           ├─ 5. Execute atomic DB transaction + write immutable audit_logs entry
           └─ 6. Revalidate affected Next.js paths / cache tags
```

### 6.2 Contradictions Between Architecture Documents (And Their Resolution)
Following the project's hierarchy of authority (`07-AI-Agents/Source-Authority-and-Conflict-Handling.md`), here is how architectural conflicts across documents resolve:

| Topic | Older KB / DevKit Claim | `RouteX Architecture Blueprint v1.md` (Oct 28, 2026) | Authoritative Resolution |
| :--- | :--- | :--- | :--- |
| **Auth Provider** | `ADR-002` & `Tech-Stack.md` specify **Auth.js (NextAuth)** with Supabase PostgreSQL. | Explicitly rejects Auth.js to avoid dual-auth drift with Supabase RLS/Storage; selects **Supabase Auth** (`@supabase/ssr`). | **Supabase Auth is active in code** (`src/lib/supabase/`) and `Blueprint v1`. Update `ADR-002` to reflect Supabase Auth (`Provisional` / `Implemented` in code). |
| **Delivery Lifecycle Statuses** | `ADR-001`, `ACL-04`, `01-delivery-management.md` mandate **Completed deliveries only**; no `In Progress` or `In Transit` lifecycle. | Blueprint §8.2 proposes creating deliveries as `In Progress` and transitioning `Draft/In Progress → Completed → Voided`. | **Knowledge Base (`ADR-001`, `ACL-04`) wins.** RouteX records **completed deliveries only**. Statuses should represent record verification/accounting state (`Recorded`/`Completed`, `Amended`, `Voided`), not live trip progress (`Confirmed`). |
| **Data Imports Module** | `Scope-and-Exclusions.md`, `ACL-12`, and `07-data-imports.md` state **no automatic data import in v1**. | Blueprint §11 proposes a 4-step CSV/XLSX bulk import pipeline (`import_batches`, `import_batch_rows`). | **Knowledge Base (`ACL-12`) wins.** Bulk CSV/XLSX import is excluded from v1 unless the client explicitly reverses `ACL-12` (`Confirmed`). |
| **Role Names** | `ADR-004` & `ACL-01` lock in 6 roles: `Admin`, `President`, `Corporate Secretary`, `Operations`, `Finance`, `HR`. | Blueprint §4.2 uses lowercase snake_case (`admin`, `president`, `corporate_secretary`, `operations`, `finance`, `hr`), while UI preview uses `Administrator`, `Finance reviewer`, `Fleet coordinator`. | The **6 canonical roles (`ACL-01`)** are mandatory; UI preview labels in `/administration` must be replaced with the 6 canonical roles (`Confirmed`). |

---

## 7. Current Implementation by Module

> **Critical Audit Rule Applied:** No feature is labeled "Implemented" merely because a button or table exists. Every module below is audited against persistence, calculation fidelity, and domain rules.

### 7.1 Authentication & Session Gate (`/login`, `/api/preview-session`, `src/proxy.ts`)
- **What Exists:**
  - [src/app/login/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/login/page.tsx): Split-panel login view with background video (`/media/login- panel-bg.mp4`), theme toggle, and mode-aware form.
  - [src/features/auth/auth-model.ts](file:///c:/Users/suchi/Documents/rrli/src/features/auth/auth-model.ts): Determines `preview` vs. `preview-login` vs. `supabase` mode.
  - [src/app/api/preview-session/route.ts](file:///c:/Users/suchi/Documents/rrli/src/app/api/preview-session/route.ts): Validates `admin` / `admin` in `preview-login` mode and sets cookie `routex-preview-session=routex-preview-ui-v1`.
- **What Is Simulated / Missing:**
  - No sign-out button exists anywhere in the UI shell (`OperationalSidebar` or `OperationalTopbar`).
  - No user profile lookup, no role claims, no password reset, and no audit log on login/logout.

### 7.2 Shared App Shell (`OperationalSidebar`, `OperationalTopbar`, `GlobalDateRangeProvider`)
- **What Exists:**
  - Sticky resizable/collapsible sidebar ([operational-sidebar.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/operational-sidebar.tsx)) with 7 nav items (`Dashboard`, `Deliveries`, `Fleet`, `Transactions`, `Reports`, `Administration`, `Settings`), active route indicator, and hardcoded footer identity (`Shinryu / Administrator`).
  - Sticky topbar ([operational-topbar.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/operational-topbar.tsx)) with interactive date-range picker, light/dark theme toggle, help button (`disabled`), and avatar badge (`SH`).
- **What Is Simulated / Missing:**
  - Global search was removed from the topbar during Report 21; only table-local search inputs exist.
  - Sidebar footer identity (`Shinryu`) and `⋯` button are static (`disabled`).

### 7.3 Dashboard (`/dashboard`)
- **Files:** [src/app/dashboard/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/dashboard/page.tsx), [src/features/dashboard/dashboard-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/dashboard/dashboard-preview-data.ts) (26 fixture deliveries `DLV-0287` to `DLV-0312` across Sep 30 – Oct 29, 2026).
- **Functional Client Logic:**
  - Reactively filters the 26 fixture deliveries by the global date range (`filterDeliveriesByDateRange`).
  - Computes 4 KPI cards (`Total revenue`, `Delivery expenses`, `Net margin`, `Completed deliveries`) and compares them against the equal-length prior period (`getPreviousDateRange`).
  - Renders an interactive SVG `RevenueChart` with custom hover/focus tooltip (`activePointIndex`) and metric tabs (`Margin`, `Revenue`, `Deliveries`) for the `Top trucks` ranking card.
  - Renders clickable `Attention needed` cards (`Missing POD` → `/deliveries`, `Margin pressure` → `/reports`, `Fleet coverage` → `/fleet`), sortable `Recent deliveries` table (top 4 rows, opens `RecordDetailDrawer`), and `Quick actions`.
- **Gaps & Discrepancies:**
  - **Ignores localStorage deliveries:** Deliveries created at `/deliveries/new` are stored in `routex-created-delivery-preview`, which `/dashboard` never reads.
  - **Ignores company overhead:** Dashboard `Net margin` is strictly $\sum \text{Delivery Revenue} - \sum \text{Delivery Expenses}$ from the 26 trip rows; it does not include company operating expenses or HR compensation.

### 7.4 Delivery Management (`/deliveries` [DELETED] and `/deliveries/new`)
- **Files:** [src/app/deliveries/new/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/deliveries/new/page.tsx), [src/features/deliveries/delivery-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/deliveries/delivery-local-preview.ts).
- **Critical Defect:**
  - **`src/app/deliveries/page.tsx` is deleted (`D`) in the working tree.** Prior to deletion (in commit `6e43ea4`), it rendered a 364-line Completed Deliveries table with KPI cards, search, POD status dropdown (`All`, `Attached`, `Missing`), truck filter, 3-state sorting, and `RecordDetailDrawer`. Codex was mid-edit wiring `readCreatedDeliveries()` into `src/app/deliveries/page.tsx` at `2026-10-29T15:23:57Z` when interrupted.
- **What `/deliveries/new` Does:**
  - Client form capturing `client`, `truck` (from static `ownedFleetTrucks`), `driver`, `completedDate` (ISO date), `revenue` (numeric), and `pod` (`Attached` | `Missing`).
  - Saves a `CreatedDeliveryPreview` record to `localStorage` (`routex-created-delivery-preview`) with `expenses: "—"` and `margin: "—"`, then navigates to `/deliveries` (which currently 404s due to the deleted `page.tsx`).
- **Gaps:**
  - Does not capture delivery expense line items (fuel, tolls, helper fees), subcontracted truck selection, or real POD file uploads.

### 7.5 Fleet Management (`/fleet`, `/fleet/new`, `/fleet/[truckId]`)
- **Files:** [src/app/fleet/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/fleet/page.tsx), [src/app/fleet/new/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/fleet/new/page.tsx), [src/app/fleet/[truckId]/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/fleet/%5BtruckId%5D/page.tsx), [src/components/truck-profile-page.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/truck-profile-page.tsx), [src/components/truck-photo-manager.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/truck-photo-manager.tsx), [src/features/fleet/fleet-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.ts).
- **Functional Client Logic:**
  - **Owned Trucks Section:** Collapsible card grid displaying 6 static trucks (`NGS 4281`, `DAA 7310`, `CBZ 1187`, `NBE 9042`, `ABX 2201`, `XCY 6612`) plus any browser-local trucks created via `/fleet/new` (`localStorage` key `routex-created-fleet-preview`), filterable by vehicle type (`4-wheeler`, `6-wheeler`, `10-wheeler`).
  - **Truck Profile & Photo Cropper (`/fleet/[truckId]`):** Displays truck summary, static availability checklist, neighbor truck links, and an interactive HTML5 canvas photo upload/zoom/drag cropper (`1200x760` JPEG saved in `localStorage` key `routex-preview-truck-photo:${truckId}`).
  - **Subcontracted Trucks Section:** Table with 4 static rows (`SUB-204` to `SUB-193`) under abbreviated providers (`AXL`, `KMV`, `TQX`, `RLP`), with search, status filter (`All`, `Delivered`, `In transit`, `Delayed`), inline `More filters` (`Type`, `Provider`), 3-state column sorting, and `RecordDetailDrawer`.
- **Gaps & Domain Violations:**
  - **Violates `ADR-001` / `ACL-04`:** Subcontracted trucks table uses live-tracking statuses (`In transit`, `Delayed`) and phrasing (`Active subcontracted trip`, `ETA window missed`), which are explicitly forbidden by the completed-deliveries-only rule.
  - **Contradictory Plate Numbers:** `NGS 4281`, `NBE 9042`, and `CBZ 1187` appear as RRLI **Owned** trucks in `ownedFleetTrucks` AND simultaneously as **Subcontracted** trucks under external providers `RLP`, `KMV`, and `TQX` in `subcontractedFleetTrucks`.
  - **Unreconciled Financial Totals:** Static totals in `ownedFleetTrucks` do not match the sum of deliveries for the same trucks in `dashboardPreviewDeliveries` (see Section 12).

### 7.6 Finance & Transactions (`/transactions`, `/transactions/new`)
- **Files:** [src/app/transactions/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/transactions/page.tsx), [src/app/transactions/new/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/transactions/new/page.tsx), [src/features/transactions/transaction-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/transactions/transaction-local-preview.ts).
- **Functional Client Logic:**
  - Displays 5 static transaction records (`TXN-0180` to `TXN-0184`) merged with browser-local entries created via `/transactions/new` (`localStorage` key `routex-created-transaction-preview`).
  - Filters by global date range, search query, status (`All`, `Verified`, `Pending`), category (`Delivery revenue`, `Fuel expense`, `Maintenance expense`), and flow (`Revenue`, `Expense`), with 3-state sorting and `RecordDetailDrawer`.
- **Gaps & Domain Violations:**
  - **Conflates Delivery Costs and Company Overhead (`ADR-005` risk):** Mixes `Delivery revenue`, `Fuel expense`, and `Maintenance expense` in one flat table without foreign keys to `delivery_id` or `truck_id` and without distinguishing delivery-attributable expenses from company operating expenses.
  - **KPI Card Only Counts Entry Count, Not PHP Totals:** The 3 KPI cards (`Revenue entries`, `Expense entries`, `Pending review`) only display row counts (`2`, `3`, `1`), not monetary sums.

### 7.7 Reports & Exports (`/reports`)
- **Files:** [src/app/reports/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/reports/page.tsx), [src/features/reports/report-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/reports/report-preview-data.ts).
- **Functional Client Logic:**
  - Derives 4 tabbed report documents (`Revenue`, `Expenses`, `Profitability`, `Operations`) dynamically from `dashboardPreviewDeliveries` filtered by `useGlobalDateRange()`.
  - Includes a working `Print report` button (`window.print()`) with dedicated `@media print` CSS rules ([globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L522)) that hide navigation/chrome and print a clean document sheet.
- **Gaps:**
  - `Export` button is `disabled` (no CSV/XLSX/PDF generation).
  - Does not include company operating expenses, HR compensation summaries, or browser-local deliveries.

### 7.8 User Accounts, Permissions, & Audit Trail (`/administration`, `/administration/audit-trail`)
- **Files:** [src/app/administration/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/administration/page.tsx), [src/app/administration/audit-trail/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/administration/audit-trail/page.tsx), [src/components/audit-trail-preview.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/audit-trail-preview.tsx), [src/features/audit/audit-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/audit/audit-preview-data.ts).
- **Functional Client Logic:**
  - Renders a searchable, filterable, sortable 3-row `Members` table (`USR-001` Shinryu, `USR-002` Marc Rancel, `USR-003` Alex Morgan) with `RecordDetailDrawer`.
  - Renders an integrated `Audit trail` section below Members (`AUD-0100` to `AUD-0105` from `auditPreviewEvents`) with search, category/status filters, sorting, and detail drawer. `/administration/audit-trail` redirects to `/administration#audit-trail`.
- **Gaps & Domain Violations:**
  - **Non-Canonical Role Labels:** Uses `Administrator`, `Finance reviewer`, and `Fleet coordinator` instead of the 6 canonical roles (`Admin`, `President`, `Corporate Secretary`, `Operations`, `Finance`, `HR` per `ADR-004`/`ACL-01`).
  - `Invite user` button is `disabled`.
  - Audit trail is a static 6-row fixture; local preview actions do not append audit events.

### 7.9 Settings (`/settings`), HR & Compensation, and Data Imports
- **Settings ([src/app/settings/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/settings/page.tsx)):** Read-only 4-card configuration summary (`Company profile`, `Roles and access`, `Reporting defaults`, `Audit and retention`). Renders `OperationalTopbar showDateFilter={false}`.
- **HR & Compensation (`05-hr-and-compensation.md`):** **Not implemented** (0 routes, 0 components, 0 fixtures).
- **Data Imports (`07-data-imports.md`):** **Not implemented** (excluded from v1 scope per `ACL-12`).

---

## 8. Reconstructed Business Requirements

All business rules below are reconstructed directly from `RouteX-Knowledge-Base` (`01-Requirements/`, `06-Decisions/`, `ACL-01`–`ACL-13`) and `RouteX_Codex_Development_Kit` (`04-data-integrity-and-domain-rules.md`, `12-decisions-and-open-questions.md`):

### 8.1 Delivery Lifecycle & Operational Rules
1. **Completed Deliveries Only (`Confirmed` — `ADR-001`, `ACL-04`, `D-001`):** RouteX records deliveries only after physical completion. Live dispatch, GPS tracking, and in-transit status workflows (`Pending`, `In Transit`, `Delayed`) are out of scope.
2. **Prototype Timing Fields Do Not Trigger Charges (`Confirmed` — `ACL-05`, `KB-017`):** Fields from the early prototype (`Call Time`, `ETA`, `Start Loading`, `End Loading`, `Departure`) are not required operational inputs and must never auto-compute delay penalties.
3. **Subcontracted Delivery Attribution (`Confirmed` — `ACL-06`, `02-fleet-management.md`):** When a delivery is fulfilled by a subcontracted truck, the record must identify the subcontractor company/provider and truck details, keeping subcontracted trips distinct from RRLI-owned truck asset utilization.
4. **POD Tracking (`Confirmed` — `01-Requirements/POD-and-Document-Handling.md`):** Every completed delivery tracks whether its Proof of Delivery is `Attached` or `Missing`. Missing PODs must surface as operational follow-up items (`Attention needed`), but whether a missing POD blocks delivery creation or financial verification is still `Provisional`/`Unresolved` (`KB-008`, `D-002`).

### 8.2 Financial Calculation & Cost-Boundary Rules
1. **Derived Delivery Margin (`Confirmed` — `01-Requirements/Business-Rules-and-Financial-Calculations.md`):**
   $$\text{Delivery Margin} = \text{Delivery Revenue} - \sum \text{Delivery-Attributable Expenses}$$
   Delivery margin must always be calculated by the system and **never manually typed or overwritten**.
2. **Strict Separation of Delivery Expenses vs. Company Operating Expenses (`Confirmed` — `ADR-005`, `ACL-08`):**
   - **Delivery-Attributable Expenses** (e.g., trip fuel, expressway tolls, helper/pahinante trip allowance, cash advance for a specific trip) belong to a specific `delivery_id` and reduce that delivery's margin (and the assigned truck's delivery contribution).
   - **Company-Level Operating Expenses** (e.g., office utilities, depot rent, general maintenance not tied to a single trip, administrative expenses, HR compensation summaries) belong to the company period ledger.
   - **Anti-Double-Counting Invariant:** An expense record must belong to **either** a delivery **or** a company/fleet operating category—never both simultaneously.
3. **No Arbitrary Overhead Allocation Across Deliveries (`Confirmed` — `ADR-005`, `04-data-integrity-and-domain-rules.md`):** Company-level overhead and HR salaries must **not** be automatically pro-rated or smeared across individual delivery margins unless the client explicitly approves an allocation formula (`D-008`, `KB-003`).
4. **`₱500/hour` Rate Is an Example Only (`Confirmed` — `ACL-07`, `D-005`, `KB-001`):** The `₱500/hour` additional-hour charge mentioned in early SRS drafts is **only an illustrative example**, not a fixed company-wide constant. The system must not hardcode `500` as an automatic multiplier.
5. **Unresolved Pricing & Expense Formulas (`Blocked` — `D-005` to `D-010`, `KB-001` to `KB-004`):**
   - Exact base delivery pricing structure (contract table vs. manual per-delivery entry).
   - Additional-hour and additional-drop charge formulas.
   - Canonical expense category taxonomy (which categories are strictly delivery-level vs. truck-level maintenance vs. company-level overhead).
   - HR compensation summary period and rate rules (`D-010`, `KB-004`).

### 8.3 Data Preservation, Void/Reversal, and Audit Trail Rules
1. **No Hard Deletion of Historical Records (`Confirmed` — `ADR-006`, `ACL-09`, `D-011`):**
   - Completed deliveries, financial transactions, trucks with history, employees with history, and user accounts with audit history **must never be hard-deleted (`DELETE FROM`)**.
   - Incorrect deliveries or financial entries must be corrected via **Void / Reversal / Amendment** workflows that require a mandatory **reason** and preserve the original values in the audit trail.
   - Retired trucks, former employees, and departing users must be **deactivated (`Active` → `Inactive`)**, keeping historical foreign keys intact.
2. **Audit Log Completeness (`Confirmed` — `01-Requirements/Data-Validation-and-Lifecycle-Rules.md`):** Every sensitive mutation must record `actor_user_id`, `actor_role`, `action_type`, `entity_type`, `entity_id`, `summary`, `before_snapshot`, `after_snapshot`, `reason` (when amending/voiding), and `created_at`.

---

## 9. Decision History and Superseded Decisions

Chronological reconstruction across the Knowledge Base, Codex Development Kit, Architecture Blueprint, and the 462 MB Codex rollout log (`2026-10-23` to `2026-10-30`):

| Date / Source | Earlier Assumption / State | Superseding Decision | Current Status |
| :--- | :--- | :--- | :--- |
| **Oct 15–19, 2026** (`LOA` vs `KB-019`) | Scanned LOA contained garbled text suggesting a "6 months (1 month)" post-acceptance support window. | Client/user clarified in `KB-019` & `D-015` that post-acceptance support is **1 month**. | `Confirmed` (`KB-019`) |
| **Oct 23, 2026** (`ADR-001`, `ACL-04`, `ACL-05`) | Early HTML prototype (`RtX_-prototype-z.html`) included `Pending`, `In Transit`, `Delayed` statuses and `Call Time`/`ETA`/`Loading` timestamps. | Superseded by `ADR-001`, `ACL-04`, `ACL-05`: RouteX records **completed deliveries only**; timing columns do not auto-compute charges. | `Confirmed` (Note: `fleet-preview-data.ts` still violates this in subcontracted rows) |
| **Oct 23, 2026** (`ACL-07`, `KB-001`) | Early SRS text referenced `₱500/hour` for additional hours as if it might be a fixed system rule. | Superseded by `ACL-07`: `₱500/hour` is an **example only**, not a universal rate. | `Confirmed` (`ACL-07`) |
| **Oct 23, 2026** (`ADR-003`, `03-Design/Design-Tokens-and-Typography.md`) | Early prototype used a dark `#020617` shell with `Plus Jakarta Sans`, `JetBrains Mono`, and `#F97316` orange accents; initial Next.js scaffold (`e011241`) used green `#27654d` accents. | Superseded during Codex frontend loop (`c81df97`–`d7088f4`) by the **Warm Amber / Soft Neumorphic + Frosted Glass** system using `Readex Pro`, `#b45309` / `#f59e0b` amber accents, and full light/dark mode parity. | `Implemented` (User-approved across Codex sessions Oct 24–30) |
| **Oct 24–28, 2026** (`ADR-002` vs `Blueprint v1` & `src/lib/supabase/`) | `ADR-002` proposed **Auth.js (NextAuth)** with Supabase PostgreSQL. | Superseded in code (`src/lib/supabase/`) and `RouteX Architecture Blueprint v1.md` (§2, §4.1) by **Supabase Auth (`@supabase/ssr`)** as sole session authority. | `Provisional` / `Implemented` in code |
| **Oct 26–29, 2026** (Reports `17`–`31` in `docs/reports/`) | Audit Trail was a standalone sidebar route (`/administration/audit-trail`); Reports was a 4-card grid with dead buttons; Topbar had a non-functional global search input. | User-directed UI refinements merged Audit Trail into `/administration#audit-trail` (Report 29), turned `/reports` into an interactive 4-tab printable document preview (Report 30), and removed dead global search from Dashboard topbar (Report 21). | `Implemented` |
| **Oct 29, 2026** (`Codex rollout 11:35Z–15:31Z`) | Subcontracted trucks used realistic company names; calendar popover was translucent; truck/delivery/transaction creation buttons were `disabled`. | User instructed Codex to: (1) use random abbreviations (`AXL`, `KMV`, `TQX`, `RLP`) for subcontracted providers; (2) make the calendar popover **fully opaque**; (3) implement browser-local creation flows (`/fleet/new`, `/deliveries/new`, `/transactions/new`) and seamless revenue chart hover tooltips. | `Implemented` (Except `/deliveries/page.tsx` was left deleted mid-edit) |

---

## 10. Current and Proposed Data Model

### 10.1 Current In-Memory / LocalStorage Preview Shapes (`src/features/`)
Currently, the application has **no database tables**. It operates on 5 TypeScript interfaces:
1. **`DashboardDeliveryPreview`** ([dashboard-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/dashboard/dashboard-preview-data.ts#L3-L13)): `{ id, completedDate, client, route, truck, driver, pod: "Attached" | "Missing", revenue: number, expenses: number }` (26 static records).
2. **`CreatedDeliveryPreview`** ([delivery-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/deliveries/delivery-local-preview.ts#L3-L17)): `{ id, client, truck, driver, completedDate, dateLabel, pod, revenue, revenueValue, expenses: "—", margin: "—", createdAt }` (stored in `localStorage`).
3. **`OwnedFleetTruckPreview`** & **`SubcontractedFleetTruckPreview`** ([fleet-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.ts#L3-L26)):
   - Owned: `{ truckId, plateNumber, vehicleType: "4-wheeler" | "6-wheeler" | "10-wheeler", operationalStatus: "Available", deliveriesCompleted, revenue, expenses, margin, isLocalPreview? }`.
   - Subcontracted: `{ unitId, company: "AXL" | "KMV" | "TQX" | "RLP", plateNumber, vehicleType, currentRoute, deliveriesLogged, billingTotal, deliveryStatus: "Delivered" | "In transit" | "Delayed", statusDetail }`.
4. **`CreatedTransactionPreview`** ([transaction-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/transactions/transaction-local-preview.ts#L6-L17)): `{ id, postedAt, postedDate, category, description, reference, status: "Pending", flow: "Revenue" | "Expense", amount, createdAt }`.
5. **`AuditPreviewEvent`** ([audit-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/audit/audit-preview-data.ts#L5-L17)): `{ id, occurredAt, occurredDate, actor, actorRole, action, category, target, status, summary, beforeState, afterState }`.

### 10.2 Proposed Relational Data Model (PostgreSQL / Supabase)
Synthesizing `02-Architecture/Data-Entities-and-Relationships.md`, `02-Architecture/ERD.md`, and `RouteX Architecture Blueprint v1.md` (§5), while enforcing `ADR-001` through `ADR-006`:

| Proposed Table | Primary Purpose & Key Columns | Domain Invariants & Constraints | Status |
| :--- | :--- | :--- | :--- |
| **`roles` & `user_profiles`** | Maps `auth.users(id)` to one of the 6 canonical roles (`Admin`, `President`, `Corporate Secretary`, `Operations`, `Finance`, `HR`), `full_name`, `is_active`. | Never hard-delete; deactivate via `is_active = false` (`ADR-006`). `Admin` role does not grant financial edit permissions (`ADR-004`). | `Proposed` |
| **`clients`** | Customer master records (`id`, `code`, `name`, `billing_address`, `is_active`). | Referenced by `deliveries.client_id`. Soft deactivation only. | `Proposed` |
| **`trucks`** | Owned and subcontracted fleet units (`id`, `plate_number` UNIQUE, `ownership_type` [`Owned`, `Subcontracted`], `subcontractor_company_id`, `vehicle_type` [`4-wheeler`, `6-wheeler`, `10-wheeler`], `photo_storage_path`, `status` [`Active`, `Maintenance`, `Inactive`]). | A plate number cannot be both `Owned` and `Subcontracted`. Never hard-delete once referenced by a delivery (`ADR-006`). | `Proposed` |
| **`subcontractor_companies`** | External partner trucking providers (`id`, `code`, `name`, `is_active`). | Used when `trucks.ownership_type = 'Subcontracted'` (`ACL-06`). | `Proposed` |
| **`employees`** | Drivers, helpers, and staff (`id`, `employee_code`, `full_name`, `designation`, `is_active`). | Supports driver assignment and HR compensation summaries (`ACL-10`). Soft deactivation only. | `Proposed` |
| **`deliveries`** | Completed delivery header (`id`, `delivery_number` UNIQUE, `client_id`, `truck_id`, `driver_employee_id`, `completed_date`, `origin`, `destination`, `revenue_amount`, `record_status` [`Recorded`, `Amended`, `Voided`], `void_reason`, `created_by`, `updated_by`). | **Completed deliveries only (`ADR-001`).** Margin is derived (`revenue_amount - SUM(delivery_expenses)`), never stored as a mutable column. | `Proposed` |
| **`delivery_expenses`** | Trip-specific expenses (`id`, `delivery_id` FK, `expense_category_id`, `amount`, `description`, `receipt_reference`, `record_status` [`Recorded`, `Voided`], `void_reason`). | **Strictly tied to a single `delivery_id` (`ADR-005`).** Cannot also be recorded in `company_expenses`. | `Proposed` |
| **`pod_documents`** | Proof of delivery metadata & storage pointers (`id`, `delivery_id` FK, `pod_status` [`Attached`, `Missing`], `storage_bucket`, `storage_object_path`, `original_filename`, `mime_type`, `file_size_bytes`, `uploaded_by`, `uploaded_at`). | Private Supabase Storage bucket; versioned/replaced without orphan deletion of audited records (`01-Requirements/POD-and-Document-Handling.md`). | `Proposed` |
| **`company_expenses`** | Non-delivery operating overhead (`id`, `expense_number` UNIQUE, `expense_date`, `expense_category_id`, `truck_id` NULLABLE for general maintenance, `amount`, `vendor`, `reference_no`, `record_status` [`Pending`, `Verified`, `Voided`], `void_reason`). | **Never linked to a `delivery_id` (`ADR-005`).** Prevents double-counting against trip expenses. | `Proposed` |
| **`compensation_summaries`** | High-level HR pay period summaries (`id`, `employee_id` FK, `period_start`, `period_end`, `gross_compensation_amount`, `notes`, `record_status` [`Recorded`, `Voided`]). | Summary level only; no tax/statutory payroll engine (`ACL-10`). | `Proposed` / `Blocked` (`D-010`) |
| **`audit_logs`** | Append-only immutable ledger (`id`, `occurred_at`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `reason`, `before_state` JSONB, `after_state` JSONB). | `INSERT`-only table (no `UPDATE` or `DELETE` privileges even for `Admin`; `ADR-006`). | `Proposed` |

---

## 11. UI/UX Design Direction

### 11.1 Verified Design System in Code (`src/app/globals.css`)
While early Knowledge Base notes (`ADR-003`, `03-Design/Design-Tokens-and-Typography.md`) documented the legacy dark-slate prototype (`#020617`, `Plus Jakarta Sans`, `JetBrains Mono`, `#F97316`), the active codebase implements a user-approved **Warm Amber / Soft Neumorphic + Frosted Glass** operational aesthetic ([src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css)):

- **Typography:** Google Font **`Readex Pro`** (`--font-sans: "Readex Pro"`), loaded in [src/app/layout.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/layout.tsx#L14-L18), with `font-variant-numeric: tabular-nums` on truck codes and financial columns.
- **Light Mode Palette (`:root` in `globals.css`):**
  - Page canvas: `--color-page: #f6f7f9`
  - Elevated surface: `--color-surface: #ffffff`, `--color-surface-subtle: #fbfcfb`
  - Text hierarchy: `--color-text-primary: #15201d`, `--color-text-secondary: #586762`, `--color-text-muted: #74827d`
  - Brand Amber Accents: `--color-accent: #b45309`, `--color-accent-deep: #7c2d12`, `--color-accent-highlight: #f59e0b`, `--color-accent-soft: #fffbeb`
  - Semantic Statuses: `--color-status-success: #0f8a4f` (Attached / Verified / Positive margin), `--color-status-warning: #a86a0c` (Missing POD / Pending review)
  - Radii & Layout: `--radius-control: 7px` (with `12px`–`14px` on rounded selects/buttons), `--radius-card: 10px`, `--sidebar-width: 248px`, `--content-max: 1250px`, `--record-detail-width: 400px`.
- **Dark Mode Parity (`html[data-theme="dark"]` in `globals.css`):**
  - Deep slate/charcoal surfaces (`#141a21`, `rgba(20, 26, 33, .92)`) with warm amber highlights, persisted in `localStorage` under `"routex-theme"` and initialized before first paint in `layout.tsx`.
- **Signature Visual & Interaction Patterns (User-Directed in Codex Sessions):**
  1. **Opaque Popovers:** Calendar date-range popover (`.date-picker-popover`) and chart hover tooltip (`.chart-point-tooltip`) are **strictly opaque** (`var(--color-surface)`) in both light and dark modes so underlying table text never bleeds through (user correction on Oct 29 at `11:36:30Z`).
  2. **Non-Modal Workspace Detail Column (`RecordDetailDrawer`):** Opening a row detail drawer adds `body.record-detail-open`, shrinking `.main-content` width by `400px` (`calc(100vw - var(--operational-sidebar-width) - var(--record-detail-width))`) so the left sidebar and main table remain interactive and undimmed ([globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L524-L534)).
  3. **Inline Toolbar Filters:** Clicking `"More filters"` in tables reveals additional `RoundedSelect` filters inline in the same toolbar row (`Type`, `Provider`) rather than stacking a full-width secondary block (user correction on Oct 29 at `12:19:20Z`).
  4. **Ranked Truck Typography Hierarchy:** On Dashboard `Top trucks`, rank numbers scale visually (`29px` for `#1`, `23px` for `#2`, `17px` for `#3`) with a hover preview pill (`View profile →`) linking to `/fleet/[truckId]` ([globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L549-L551)).
  5. **Turbopack CSS Note:** Per `13-progress-and-handoff.md` (2026-10-29), CSS Modules returned empty class mappings under the project's Next.js 16 Turbopack runtime; therefore, all styling is consolidated in [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css).

---

## 12. Known Bugs and Technical Debt

Every defect below was verified directly in the current source tree (`c:\Users\suchi\Documents\rrli`):

| ID | Severity | Location | Verified Defect / Technical Debt |
| :--- | :--- | :--- | :--- |
| **BUG-01** | **CRITICAL (Blocker)** | `src/app/deliveries/page.tsx` & `.next/types/validator.ts` | **Deleted `/deliveries` Route Breaks Navigation & Typecheck:** `src/app/deliveries/page.tsx` is deleted (`D` in `git status`) after an interrupted Codex edit at `2026-10-29T15:23:57Z`. Navigating to `/deliveries` from the sidebar, Dashboard, or `/deliveries/new` will 404, and running `npx tsc --noEmit` fails with `error TS2307: Cannot find module '../../src/app/deliveries/page.js'`. |
| **BUG-02** | **HIGH (Domain Violation)** | [fleet-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.ts#L93-L142) | **Owned vs. Subcontracted Plate Collision:** Plate numbers `NGS 4281`, `NBE 9042`, and `CBZ 1187` are defined as RRLI **Owned** trucks in `ownedFleetTrucks` AND simultaneously as **Subcontracted** partner trucks under providers `RLP`, `KMV`, and `TQX` in `subcontractedFleetTrucks`. |
| **BUG-03** | **HIGH (Domain Violation)** | [fleet-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.ts#L93-L142) & [fleet/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/fleet/page.tsx) | **Forbidden Live-Tracking Statuses in Subcontracted Fleet:** `subcontractedFleetTrucks` uses `deliveryStatus: "In transit" | "Delayed"` and status copy `"Active subcontracted trip"` / `"ETA window missed"`, violating `ADR-001`, `ACL-04`, and `ACL-05` (completed-deliveries-only; no live tracking or ETA penalty states). |
| **BUG-04** | **HIGH (Data Integrity)** | [fleet-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.ts#L31-L91) vs [dashboard-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/dashboard/dashboard-preview-data.ts#L15-L276) | **Unreconciled Financial Totals Across Fixtures:** In `ownedFleetTrucks`, truck `NGS 4281` shows hardcoded `deliveriesCompleted: 18`, `revenue: "₱158,300"`, `expenses: "₱70,600"`, `margin: "₱87,700"`. In `dashboardPreviewDeliveries` (and `/reports`), summing all 6 deliveries for `NGS 4281` yields Revenue `₱134,400`, Expenses `₱61,300`, Margin `₱73,100`. |
| **BUG-05** | **MEDIUM (State Silos)** | `delivery-local-preview.ts`, `fleet-preview-data.ts`, `dashboard/page.tsx`, `reports/page.tsx` | **Disconnected LocalStorage Silos:** (1) Deliveries created in `/deliveries/new` (`routex-created-delivery-preview`) never appear on `/dashboard` or `/reports`. (2) Trucks created in `/fleet/new` (`routex-created-fleet-preview`) never appear in the Truck dropdown of `/deliveries/new` (which reads only static `ownedFleetTrucks`). |
| **BUG-06** | **MEDIUM (Domain Violation)** | [administration/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/administration/page.tsx#L19-L47) | **Non-Canonical Role Names in Administration UI:** Uses `Administrator`, `Finance reviewer`, and `Fleet coordinator` instead of the 6 canonical roles (`Admin`, `President`, `Corporate Secretary`, `Operations`, `Finance`, `HR`) mandated by `ADR-004` and `ACL-01`. |
| **BUG-07** | **MEDIUM (UX / Quota)** | [truck-photo-manager.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/truck-photo-manager.tsx#L22) | **LocalStorage Quota Risk on Truck Photos:** `MAX_FILE_BYTES` allows 10 MB uploads and saves base64 data URLs to `localStorage`. Although cropped output is resized to `1200x760` JPEG, storing multiple high-detail base64 images in `localStorage` risks hitting the browser ~5 MB origin quota. |
| **BUG-08** | **LOW (UX Polish)** | [dashboard/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/dashboard/page.tsx#L159-L296) & [error.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/error.tsx#L26) | (1) Dashboard `RevenueChart` requires hovering individual `<g className="chart-point">` circles rather than scrubbing seamlessly across the SVG plot width (noted by user at `2026-10-29T15:31:15Z`). (2) `error.tsx` link labeled `"Return to deliveries"` points to `href="/"` (which redirects to `/dashboard`, not `/deliveries`). (3) No sign-out button exists in the app shell. |
| **DEBT-01** | **MEDIUM (Maintainability)** | [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css) | **605-Line Monolithic CSS File with Cascade Overrides:** `globals.css` contains sequential design iterations where rules at lines 54–130 override earlier rules at lines 41–53 (e.g., `.sidebar`, `.topbar`, `.nav-item.active`, `.records-card` are redefined 3–4 times). |

---

## 13. Security and Production Readiness

### 13.1 Current Security Posture (`Implemented` vs. `Missing`)
- **What Is Properly Guarded Today:**
  - **Environment Validation ([src/lib/config/env.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/config/env.ts)):** Validates `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` via Zod without echoing raw values into error messages.
  - **Open-Redirect Prevention ([src/lib/auth/route-policy.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/auth/route-policy.ts#L17-L29)):** `sanitizeNextPath` blocks external URLs, protocol-relative paths (`//evil.com`), backslash tricks (`/\`), and `/login` loops.
  - **Error Redaction ([src/lib/errors/app-error.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/errors/app-error.ts)):** Redacts unexpected server errors to `"An unexpected error occurred. Please try again."` unless `expose: true` is explicitly set on an `AppError`.
  - **Server-Only Boundary:** `src/lib/errors/app-error.ts` and `src/lib/supabase/server.ts` import `"server-only"`.
- **Critical Production Security Risks:**
  1. **Hardcoded `admin` / `admin` Preview Backdoor ([src/lib/auth/preview-session.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/auth/preview-session.ts#L1-L26)):** When deployed to a non-development environment (e.g., Vercel) without valid `NEXT_PUBLIC_SUPABASE_*` variables, `/api/preview-session` accepts hardcoded username `admin` and password `admin` and sets a static, unsigned, non-cryptographic cookie (`routex-preview-session=routex-preview-ui-v1`). Anyone who knows the static cookie string can forge the cookie without even calling the login endpoint. **This mechanism must be completely disabled/removed before production launch.**
  2. **Zero Role-Based Access Control (RBAC):** Neither `src/proxy.ts` nor any route component inspects user roles. An authenticated user (or preview visitor) has identical access to Dashboard, Deliveries, Fleet, Transactions, Reports, Administration, and Settings.
  3. **Zero Row-Level Security (RLS) or Server-Side Mutation Guards:** No Supabase RLS policies, database roles, or authenticated Server Actions exist yet.
  4. **No Rate Limiting or CSRF/Brute-Force Protection:** `/api/preview-session` has no rate limiter or lockout policy.

---

## 14. Testing and Verification Status

### 14.1 Current Automated Test Suite (`npm test`)
Running `npm test` executes **11 test files (28 unit tests)** via Node's native TypeScript test runner (`node --test --experimental-strip-types`). **All 28 tests pass in ~1.55s:**

| Test File | Tests | What It Actually Verifies |
| :--- | :---: | :--- |
| [sidebar-state-model.test.ts](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state-model.test.ts) | 5 | Sidebar width clamping (`188px`–`320px`), collapse threshold (`136px`), rail snap (`76px`), keyboard step resizing. |
| [sortable-table-header.test.ts](file:///c:/Users/suchi/Documents/rrli/src/components/sortable-table-header.test.ts) | 2 | 3-state sort cycle (`asc` → `desc` → `null`) and switching active sort columns. |
| [audit-preview-data.test.ts](file:///c:/Users/suchi/Documents/rrli/src/features/audit/audit-preview-data.test.ts) | 1 | Unique `AUD-*` IDs, ISO date prefix match, non-empty before/after state strings. |
| [auth-model.test.ts](file:///c:/Users/suchi/Documents/rrli/src/features/auth/auth-model.test.ts) | 3 | `signInSchema` email/password validation and `getAuthenticationMode` resolution (`preview`, `preview-login`, `supabase`). |
| [dashboard-preview-data.test.ts](file:///c:/Users/suchi/Documents/rrli/src/features/dashboard/dashboard-preview-data.test.ts) | 3 | Inclusive date-range filtering, KPI summation (`revenue - expenses`), truck ranking order, and prior-period window calculation. |
| [fleet-preview-data.test.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.test.ts) | 2 | Lookup of the 6 static owned trucks by `truckId` (`ngs-4281`, etc.) and `undefined` for unknown IDs. |
| [report-preview-data.test.ts](file:///c:/Users/suchi/Documents/rrli/src/features/reports/report-preview-data.test.ts) | 1 | Reconciles all 4 report tab aggregates (`Revenue`, `Expenses`, `Profitability`, `Operations`) against filtered delivery rows. |
| [preview-session.test.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/auth/preview-session.test.ts) | 2 | Verifies `admin`/`admin` credential check and `routex-preview-ui-v1` cookie token check. |
| [route-policy.test.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/auth/route-policy.test.ts) | 3 | Public vs. protected route classification and `sanitizeNextPath` open-redirect defense. |
| [env.test.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/config/env.test.ts) | 3 | Zod validation of `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` without secret leakage. |
| [app-error.test.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/errors/app-error.test.ts) | 3 | Safe client error exposure vs. unexpected server error redaction. |

### 14.2 TypeScript Check Status (`npx tsc --noEmit`)
- **Currently FAILING (Exit Code 1):**
  - `.next/types/validator.ts(109,39): error TS2307: Cannot find module '../../src/app/deliveries/page.js'` (caused by the uncommitted deletion of `src/app/deliveries/page.tsx`).

### 14.3 What Is NOT Tested Yet
- Zero React component rendering or DOM interaction tests.
- Zero tests for `delivery-local-preview.ts`, `transaction-local-preview.ts`, or local truck creation in `fleet-preview-data.ts`.
- Zero RBAC authorization tests, database constraint tests, void/reversal audit tests, or end-to-end (Playwright) tests.

---

## 15. Confirmed Decisions

These decisions are explicitly approved in `ADR-001`–`ADR-006`, `ACL-01`–`ACL-13`, and `12-decisions-and-open-questions.md` and **must not be violated**:

| Decision ID | Confirmed Rule / Constraint | Authoritative Source | Implemented in Code? |
| :--- | :--- | :--- | :--- |
| **`ADR-001` / `ACL-04` / `D-001`** | **Post-Delivery Scope Only:** RouteX records **completed deliveries only**. No live dispatch, GPS tracking, or in-transit delivery status workflows (`Pending`, `In Transit`, `Delayed`). | `ADR-001`, `ACL-04`, `01-delivery-management.md` | Partial (`/deliveries/new` is completed-only, but `/fleet` subcontracted table still shows `In transit` / `Delayed`). |
| **`ACL-05` / `KB-017`** | **No Automated Timing Penalties:** Prototype timing columns (`Call Time`, `ETA`, `Start/End Loading`, `Departure`) are excluded from core workflow and must not trigger automatic charges. | `ACL-05`, `KB-017` | Yes (No timing penalty logic exists). |
| **`ADR-004` / `ACL-01` / `D-012`** | **Six Canonical Roles:** `Admin`, `President`, `Corporate Secretary`, `Operations`, `Finance`, `HR`. | `ADR-004`, `ACL-01`, `Roles-and-Permissions.md` | **No** (`/administration` uses non-canonical labels; no RBAC exists). |
| **`ADR-004` / `ACL-02`** | **Admin ≠ Financial Editor:** `Admin` manages users/roles/settings and does **not** automatically receive permission to edit financial records. | `ADR-004`, `ACL-02` | **No** (Not enforced yet). |
| **`ACL-03` / `D-003`** | **Operations & Finance Financial Edits:** Both `Operations` and `Finance` may edit delivery financial entries (subject to audit logging and final permission matrix). | `ACL-03`, `D-003` | **No** (Not enforced yet). |
| **`ADR-005` / `ACL-08`** | **Expense Separation & No Double-Counting:** Delivery-attributable expenses and company operating expenses must remain strictly separated; company overhead must not be arbitrarily smeared across deliveries. | `ADR-005`, `ACL-08`, `04-data-integrity-and-domain-rules.md` | **No** (`/transactions` mixes delivery revenue, fuel, and maintenance in one flat list). |
| **`ACL-07` / `D-005` / `KB-001`** | **`₱500/hour` Is an Example Only:** The `₱500/hr` additional-hour figure is illustrative and must not be hardcoded as a fixed billing rule. | `ACL-07`, `D-005`, `KB-001` | Yes (Not hardcoded). |
| **`ADR-006` / `ACL-09` / `D-011`** | **Preserve History (No Hard Deletes):** Never hard-delete deliveries, financial records, referenced trucks, employees, or audited users. Use void/reversal/amendment with reason and deactivate master records. | `ADR-006`, `ACL-09`, `D-011` | Partial (UI has no delete buttons, but no void/reversal workflow or DB schema exists yet). |
| **`ACL-10` / `05-hr-and-compensation.md`** | **HR Module Is Compensation Summaries Only:** Captures high-level employee compensation summaries for profitability context—not a full payroll/tax/deduction system. | `ACL-10`, `05-hr-and-compensation.md` | Not implemented yet. |
| **`ACL-11` / `02-fleet-management.md`** | **Canonical Owned Truck Categories:** `4-wheeler`, `6-wheeler`, `10-wheeler`, plus separate tracking of subcontracted partner trucks. | `ACL-11`, `02-fleet-management.md` | **Yes** (`fleet-preview-data.ts`, `/fleet`, `/fleet/new`). |
| **`ACL-12` / `07-data-imports.md`** | **No Automatic Bulk Imports in v1:** Automated CSV/XLSX import pipelines are excluded from initial release scope. | `ACL-12`, `Scope-and-Exclusions.md` | Yes (No import route implemented). |
| **`KB-019` / `D-015`** | **1-Month Post-Acceptance Support Window:** Clarified by user as 1 month after formal acceptance. | `KB-019`, `D-015` | Documented. |

---

## 16. Provisional Decisions

These choices are currently active in the repository or working architecture (`RouteX Architecture Blueprint v1.md`) and enable safe progress, but require formal ADR alignment or client sign-off before production lock-in:

1. **Supabase Auth (`@supabase/ssr`) Over Auth.js (`Provisional` / `Implemented` in code):**
   - *Context:* `ADR-002` originally named Auth.js, but `src/lib/supabase/` and `RouteX Architecture Blueprint v1.md` implement `@supabase/ssr` (`getClaims()`) so that session cookies natively authenticate Supabase PostgreSQL RLS and Supabase Storage without dual-auth synchronization bugs.
   - *Action Needed:* Formally update `ADR-002` to confirm Supabase Auth as the canonical authentication provider.
2. **Warm Amber / Readex Pro Visual System with Light & Dark Themes (`Provisional` / `Implemented` in code):**
   - *Context:* Replaces the legacy dark-slate prototype palette in `ADR-003` and was iteratively approved by the user across Oct 24–30 Codex sessions.
   - *Action Needed:* Update `ADR-003` and `03-Design/Design-Tokens-and-Typography.md` to match the live CSS custom properties in [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css).
3. **Temporary Hosted Preview Login (`admin` / `admin`) for Pre-Database Vercel Reviews (`Provisional` / `Implemented` in code):**
   - *Context:* Used when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are absent in hosted preview builds (`src/lib/auth/preview-session.ts`).
   - *Constraint:* Strictly temporary; must be disabled before production cutover.
4. **Integrated Audit Trail Under `/administration#audit-trail` (`Provisional` / `Implemented` in code):**
   - *Context:* Merged into `/administration` during Report 29 per user UI feedback, with `/administration/audit-trail` redirecting to `/administration#audit-trail`.

---

## 17. Unresolved Questions and Blockers

Per `12-decisions-and-open-questions.md` (`D-002`–`D-018`) and `08-Logs/Issues-and-TODOs.md` (`KB-001`–`KB-015`), the following unresolved items **block backend persistence, financial calculations, and RBAC implementation**:

| Blocker ID | Category | Unresolved Question | What It Blocks |
| :--- | :--- | :--- | :--- |
| **`D-005` / `KB-001`** | Finance / Pricing | What is the exact formula/rate structure for **base delivery revenue** and **additional-hour charges** (client contract table vs. manual per-trip entry vs. truck-type rate)? | Automated revenue calculation in Delivery forms & DB schema. |
| **`D-006` / `KB-002`** | Finance / Pricing | How are **additional drops / multi-stop deliveries** priced and recorded on a completed delivery? | Delivery form fields & revenue calculation logic. |
| **`D-007` / `D-009`** | Finance / Expenses | What is the canonical **expense category taxonomy**, and which categories belong strictly to `delivery_expenses` vs. `company_expenses` vs. truck maintenance? | `expense_categories` seed data, `/transactions` schema, and anti-double-counting validation. |
| **`D-008` / `KB-003`** | Profitability | How should **company net profitability** combine delivery margins, non-trip truck maintenance, company operating overhead, and HR compensation summaries (period statement only, or any truck-level overhead attribution)? | Company-wide Profitability Report & Dashboard net profit formula. |
| **`D-010` / `KB-004`** | HR & Compensation | What fields, pay period frequencies (weekly/semi-monthly/monthly), and worker types (regular drivers, helpers, office staff) are required in **HR compensation summaries**? | Designing and building the missing HR & Compensation module (`05-hr-and-compensation.md`). |
| **`D-012` / `D-013` / `KB-005` / `KB-006`** | RBAC / Security | What is the complete **6-role × module action permission matrix** (`View`, `Create`, `Edit`, `Verify`, `Void/Reverse`, `Export`, `Manage Users`), and what are **`Corporate Secretary`'s** exact permissions? | Supabase RLS policies, Server Action role guards, and UI action visibility. |
| **`D-002` / `KB-008`** | POD & Workflow | Can a completed delivery be saved when POD is `Missing`, and does a `Missing` POD block Finance from marking a delivery's financials as `Verified`? | Delivery creation validation & POD upload state machine. |
| **`D-004` / `KB-010`** | Audit & Corrections | Who can authorize a **Void / Reversal / Amendment** of a verified delivery or expense, and does it require a two-step approval (e.g., Operations requests → Finance/President approves)? | Mutation workflows and `audit_logs` status transitions. |
| **`D-014` / `KB-009`** | Storage & Retention | What are the maximum file size, allowed MIME types (`PDF`, `JPG`, `PNG`), naming convention, and retention period for **POD uploads** in Supabase Storage? | Supabase Storage bucket policies & POD upload component. |
| **`D-017` / `KB-011`** | Exports | Which exact report export formats (`CSV`, `XLSX`, `PDF`) and column layouts are required for client acceptance? | Enabling the currently disabled `Export` button on `/reports` and tables. |

---

## 18. Recommended Development Roadmap

The roadmap below sequences remaining work into **5 logical phases**, separating work that **can begin immediately** (without guessing unresolved business rules) from work that **requires user/client clarification first**.

---

### Phase 1: Immediate Stabilization, Regression Recovery & Fixture Alignment
> **Readiness:** **Can begin immediately** (all rules involved are already `Confirmed`).

#### Task 1.1: Restore `/deliveries` Page and Complete Local Creation Wiring
- **Expected Outcome:** Restore `src/app/deliveries/page.tsx` (deleted during Codex's interrupted edit), connect it to `readCreatedDeliveries()` (`src/features/deliveries/delivery-local-preview.ts`) so newly created local preview deliveries appear in the table and detail drawer, and fix `npx tsc --noEmit`.
- **Dependencies:** None.
- **Relevant Files:** `src/app/deliveries/page.tsx`, `src/features/deliveries/delivery-local-preview.ts`, `src/app/deliveries/new/page.tsx`.
- **Business Rules Involved:** Completed deliveries only (`ADR-001`, `ACL-04`); derived margin display; POD status (`Attached` | `Missing`).
- **Security / Data-Integrity Requirements:** Clearly badge browser-local records as preview-only; do not fabricate expense or margin amounts when expenses are not entered (`"—"`).
- **Verification Tests Required:** `npx tsc --noEmit` (must exit 0), `npm test`, plus a new unit test `src/features/deliveries/delivery-local-preview.test.ts` verifying normalization and date filtering.
- **Can Begin Immediately?** **Yes.**

#### Task 1.2: Reconcile Preview Fixtures & Eliminate Domain Violations
- **Expected Outcome:**
  1. Remove `NGS 4281`, `NBE 9042`, and `CBZ 1187` from `subcontractedFleetTrucks` (giving subcontracted rows distinct partner plate numbers so no truck is simultaneously Owned and Subcontracted).
  2. Replace forbidden live-tracking statuses (`In transit`, `Delayed`, `"Active subcontracted trip"`, `"ETA window missed"`) in `subcontractedFleetTrucks` and `/fleet` with completed-delivery recordkeeping statuses (`Recorded`, `POD missing`, `Pending billing review`).
  3. Reconcile `ownedFleetTrucks` revenue, expenses, margin, and delivery counts with `dashboardPreviewDeliveries` so Truck cards, Dashboard rankings, and Reports show identical numbers.
  4. Replace non-canonical role labels in `/administration` (`Administrator`, `Finance reviewer`, `Fleet coordinator`) with the 6 canonical roles (`Admin`, `President`, `Corporate Secretary`, `Operations`, `Finance`, `HR`).
- **Dependencies:** Task 1.1.
- **Relevant Files:** `src/features/fleet/fleet-preview-data.ts`, `src/app/fleet/page.tsx`, `src/features/dashboard/dashboard-preview-data.ts`, `src/app/administration/page.tsx`.
- **Business Rules Involved:** `ADR-001`, `ACL-01`, `ACL-04`, `ACL-05`, `ACL-06`, `ADR-004`.
- **Security / Data-Integrity Requirements:** Cross-screen financial consistency (Company → Truck → Delivery totals must reconcile).
- **Verification Tests Required:** Add a reconciliation assertion in `src/features/fleet/fleet-preview-data.test.ts` verifying that `ownedFleetTrucks` totals match `dashboardPreviewDeliveries` aggregates and that owned vs. subcontracted plate sets are disjoint.
- **Can Begin Immediately?** **Yes.**

#### Task 1.3: Unify Browser-Local Preview State Across Screens & Polish Pending UI Requests
- **Expected Outcome:**
  1. Connect `readCreatedOwnedFleetTrucks()` to `/deliveries/new` so newly created local trucks can be selected when recording a preview delivery.
  2. Connect `RevenueChart` on `/dashboard` to a continuous horizontal pointer/mouse move handler (`onPointerMove` across the SVG plot area snapping to the nearest date x-coordinate) so hovering transitions seamlessly from point to point without the tooltip disappearing (fulfilling the user's Oct 29 `15:31:15Z` prompt).
  3. Fix the misleading link label in `src/app/error.tsx` and add a preview Sign Out action in `OperationalSidebar`.
- **Dependencies:** Task 1.1.
- **Relevant Files:** `src/app/dashboard/page.tsx`, `src/app/deliveries/new/page.tsx`, `src/app/error.tsx`, `src/components/operational-sidebar.tsx`.
- **Business Rules Involved:** Traceability between created trucks and deliveries.
- **Security / Data-Integrity Requirements:** Sign-out in `preview-login` mode must clear the `routex-preview-session` cookie via `DELETE /api/preview-session`.
- **Verification Tests Required:** Unit test for nearest-point chart index calculation and `DELETE /api/preview-session` cookie clearing.
- **Can Begin Immediately?** **Yes.**

---

### Phase 2: Domain Rule & Access Matrix Lock-In (Decision Gate)
> **Readiness:** **Requires user / client clarification first** (resolves `D-002`–`D-018` / `KB-001`–`KB-011`).

#### Task 2.1: Resolve Blocking Business Decisions & Update ADRs
- **Expected Outcome:** Record explicit user/client decisions for:
  1. Complete 6-role permission matrix (`Admin`, `President`, `Corporate Secretary`, `Operations`, `Finance`, `HR`) including `Corporate Secretary` permissions (`D-012`, `D-013`).
  2. Expense category taxonomy (`delivery_expenses` vs. `company_expenses`) and how company overhead + HR compensation summaries appear in net profitability reports (`D-007`, `D-008`, `D-009`).
  3. Base delivery revenue entry rules (manual contract amount vs. rate card) and optional additional-hour / additional-drop line items (`D-005`, `D-006`).
  4. HR compensation summary fields and pay-period structure (`D-010`).
  5. POD missing-attachment policy and Storage file limits (`D-002`, `D-014`).
  6. Update `ADR-002` (Supabase Auth) and `ADR-003` (Warm Amber / Readex Pro design system) to match the active implementation.
- **Dependencies:** User/client input.
- **Relevant Files:** `RouteX-Knowledge-Base/06-Decisions/ADR-*.md`, `RouteX_Codex_Development_Kit/docs/12-decisions-and-open-questions.md`.
- **Can Begin Immediately?** **Requires user clarification first.**

---

### Phase 3: Supabase Schema, RLS, Authentication & Audit Foundation
> **Readiness:** Schema for core entities can be drafted now as SQL migrations, but final RLS policies and financial columns depend on **Phase 2**.

#### Task 3.1: Author Initial Supabase PostgreSQL Migrations & Immutable Audit Trigger
- **Expected Outcome:** Create versioned SQL migrations under `supabase/migrations/` defining:
  - Enums/lookup tables for the 6 canonical roles, vehicle types (`4-wheeler`, `6-wheeler`, `10-wheeler`), truck ownership (`Owned`, `Subcontracted`), POD status (`Attached`, `Missing`), and record lifecycle states (`Recorded`, `Amended`, `Voided`).
  - Core tables: `user_profiles`, `clients`, `subcontractor_companies`, `trucks`, `employees`, `expense_categories`, `deliveries`, `delivery_expenses`, `pod_documents`, `company_expenses`, `compensation_summaries`, and append-only `audit_logs`.
  - Database constraints preventing hard deletes on historical tables (`REVOKE DELETE`, `BEFORE DELETE` trigger raising an exception) and enforcing that `delivery_expenses` always reference a `delivery_id` while `company_expenses` never reference a `delivery_id` (`ADR-005`, `ADR-006`).
- **Dependencies:** Phase 2 (for final category/HR columns).
- **Relevant Files:** `supabase/migrations/0001_routex_core_schema.sql`, `src/lib/supabase/`.
- **Business Rules Involved:** `ADR-001`, `ADR-004`, `ADR-005`, `ADR-006`, `ACL-01`–`ACL-11`.
- **Security / Data-Integrity Requirements:** Row-Level Security (RLS) enabled on all tables; `audit_logs` restricted to `INSERT` and `SELECT` only; `Admin` blocked from mutating financial tables unless permitted by role policy.
- **Verification Tests Required:** Schema constraint tests verifying that (a) `DELETE` on `deliveries` or `company_expenses` is rejected, (b) delivery margin views equal `revenue_amount - COALESCE(SUM(delivery_expenses.amount), 0)`, and (c) unauthorized roles are rejected.
- **Can Begin Immediately?** Draft SQL skeleton can begin; final migration lock requires **Phase 2**.

#### Task 3.2: Wire Real Supabase Auth, Role Resolution & Enforce Server-Side RBAC
- **Expected Outcome:**
  - Connect `/login` and `src/proxy.ts` to live Supabase Auth accounts mapped to `user_profiles.role`.
  - Add a server-side `requireRole(allowedRoles)` guard in `src/lib/auth/` used by all Server Components and Server Actions.
  - Display the signed-in user's real name and canonical role in `OperationalSidebar` and enforce role-based navigation and action visibility.
  - Disable the `admin`/`admin` preview backdoor whenever `NODE_ENV === "production"` and require explicit opt-in (`ENABLE_PREVIEW_LOGIN=true`) if ever needed on a staging branch.
- **Dependencies:** Task 3.1 & Task 2.1 (`D-012`, `D-013`).
- **Relevant Files:** `src/proxy.ts`, `src/lib/auth/`, `src/features/auth/auth-model.ts`, `src/app/login/page.tsx`, `src/components/operational-sidebar.tsx`.
- **Verification Tests Required:** Unit and integration tests covering all 6 canonical roles against the route/action permission matrix, plus verification that `admin` cannot mutate financial records (`ACL-02`).
- **Can Begin Immediately?** Guard utilities and production disablement of `admin/admin` can begin now; final role matrix requires **Phase 2**.

---

### Phase 4: Core Operational & Financial Module Persistence
> **Readiness:** Depends on **Phase 2 & Phase 3**.

#### Task 4.1: Persistent Fleet & Subcontractor Management (`/fleet`)
- **Expected Outcome:** Replace `localStorage` and static arrays in `/fleet`, `/fleet/new`, and `/fleet/[truckId]` with Supabase queries and Server Actions for creating, editing, and deactivating (`Active` / `Maintenance` / `Inactive`) Owned and Subcontracted trucks, plus uploading cropped truck photos to a Supabase Storage bucket.
- **Dependencies:** Tasks 3.1, 3.2.
- **Relevant Files:** `src/app/fleet/`, `src/components/truck-profile-page.tsx`, `src/components/truck-photo-manager.tsx`.
- **Business Rules Involved:** `ACL-06`, `ACL-11`, `ADR-006` (deactivation only, never hard-delete).
- **Verification Tests Required:** Server action validation tests (unique plate number, ownership separation, deactivation preserving historical delivery links).

#### Task 4.2: Persistent Completed Deliveries, Trip Expenses & POD Uploads (`/deliveries`)
- **Expected Outcome:**
  - Full create, view, amend, and void workflows for completed deliveries (`/deliveries`, `/deliveries/new`, `/deliveries/[id]`).
  - Line-item entry for delivery-attributable expenses (`delivery_expenses`) with real-time derived margin calculation ($\text{Revenue} - \sum \text{Trip Expenses}$).
  - Private Supabase Storage upload and signed-URL viewer for POD files (`pod_documents`).
  - Mandatory `reason` and automatic `audit_logs` snapshot on any amendment or void action.
- **Dependencies:** Tasks 2.1, 3.1, 3.2, 4.1.
- **Relevant Files:** `src/app/deliveries/`, `src/features/deliveries/`.
- **Business Rules Involved:** `ADR-001`, `ADR-005`, `ADR-006`, `ACL-03`, `ACL-04`, `ACL-05`, `ACL-07`.
- **Verification Tests Required:** Margin derivation tests, void/amendment audit trail tests, POD storage authorization tests.

#### Task 4.3: Persistent Company Expenses & HR Compensation Summaries (`/transactions`, `/hr`)
- **Expected Outcome:**
  - Refactor `/transactions` so it clearly separates **Delivery Financial Entries** (linked to `deliveries`) from **Company Operating Expenses** (`company_expenses`), eliminating any possibility of double-counting (`ADR-005`).
  - Implement the missing **HR & Compensation Summary** view/section (`05-hr-and-compensation.md`, `ACL-10`) for recording employee compensation summaries by pay period.
- **Dependencies:** Tasks 2.1 (`D-007`, `D-010`), 3.1, 3.2.
- **Relevant Files:** `src/app/transactions/`, new `src/app/hr/` (or compensation tab under `/transactions` / `/administration` per user preference).
- **Business Rules Involved:** `ADR-005`, `ADR-006`, `ACL-08`, `ACL-10`.
- **Verification Tests Required:** Anti-double-counting tests proving an expense cannot be summed in both delivery expenses and company operating expenses.

---

### Phase 5: Live Profitability Analytics, Exports, Administration & UAT
> **Readiness:** Depends on **Phase 4**.

#### Task 5.1: Live Dashboard, Reconciled Reports & File Exports (`/dashboard`, `/reports`)
- **Expected Outcome:**
  - Drive `/dashboard` and `/reports` from live PostgreSQL queries filtered by the selected date range.
  - Ensure full drill-down reconciliation: Company Net Result → Truck Contribution → Completed Delivery Margin → Source Expense/POD records.
  - Enable the `Export` button on `/reports` and `/deliveries` to generate downloadable `CSV` / `XLSX` / `PDF` files (`D-017`) with an accompanying audit log entry.
- **Dependencies:** Tasks 4.1–4.3, `D-008`, `D-017`.
- **Relevant Files:** `src/app/dashboard/page.tsx`, `src/app/reports/page.tsx`, `src/features/dashboard/`, `src/features/reports/`.
- **Verification Tests Required:** Automated reconciliation test verifying that Dashboard KPIs, Fleet truck cards, and all 4 Report tabs produce identical sums for any date range.

#### Task 5.2: Live User Administration, Audit Trail Viewer & Pre-Launch Hardening (`/administration`)
- **Expected Outcome:**
  - Enable `Admin` users to invite users, assign/change any of the 6 canonical roles, and deactivate/reactivate accounts (`user_profiles`) with every change written to `audit_logs`.
  - Connect `/administration#audit-trail` to the live `audit_logs` table with server-side pagination and filtering.
  - Completely remove `/api/preview-session` and hardcoded `admin`/`admin` credentials prior to production release.
- **Dependencies:** Tasks 3.1, 3.2.
- **Relevant Files:** `src/app/administration/page.tsx`, `src/components/audit-trail-preview.tsx`, `src/lib/auth/preview-session.ts`.
- **Verification Tests Required:** End-to-end UAT acceptance suite (`10-testing-and-acceptance.md`).

---

## 19. Immediate Next Steps

To move forward cleanly without losing momentum or violating domain rules, execute these steps in exact order:

1. **[IMMEDIATE — No Blockers] Restore `src/app/deliveries/page.tsx` and Fix TypeScript Build (`Task 1.1`):**
   - Recover `src/app/deliveries/page.tsx` from `HEAD` (`6e43ea4`) and finish wiring `readCreatedDeliveries()` (`src/features/deliveries/delivery-local-preview.ts`) that Codex was in the middle of editing at `2026-10-29T15:23:57Z`. Verify `npx tsc --noEmit` and `npm test` both pass with 0 errors.
2. **[IMMEDIATE — No Blockers] Fix Fixture Contradictions & Domain Rule Violations (`Task 1.2`):**
   - Separate Owned vs. Subcontracted truck plate numbers in `src/features/fleet/fleet-preview-data.ts`.
   - Replace forbidden `In transit` / `Delayed` statuses in subcontracted fleet rows with completed-delivery statuses (`ADR-001`, `ACL-04`).
   - Reconcile `ownedFleetTrucks` PHP totals with `dashboardPreviewDeliveries` and update `/administration` role badges to the 6 canonical roles (`ACL-01`).
3. **[IMMEDIATE — No Blockers] Complete Seamless Revenue Chart Scrubbing & Local Truck Dropdown Wiring (`Task 1.3`):**
   - Update `RevenueChart` in `src/app/dashboard/page.tsx` so hovering anywhere across the chart plot smoothly transitions the active point and tooltip without disappearing (completing the user's latest UI prompt).
   - Include browser-local trucks (`readCreatedOwnedFleetTrucks()`) in `/deliveries/new`.
4. **[DECISION GATE — Ask User / Client] Resolve the Top 5 Blocking Business Questions (`Task 2.1`):**
   - Confirm the 6-role permission matrix (especially `Corporate Secretary` and who can approve voids/reversals).
   - Confirm the expense category taxonomy (`delivery_expenses` vs. `company_expenses`) and how company overhead + HR compensation summaries roll into net profitability.
   - Confirm whether delivery revenue is entered manually per completed trip or computed from rate cards/additional-hour/drop rules.

---

## 20. Source References and Evidence

### 20.1 Git Commit History Examined
- `d7088f4` (2026-10-29): *Refine RouteX preview flows and transitions*
- `6e43ea4` (2026-10-29): *Polish deliveries, sidebar, and topbar interactions* (last commit containing `src/app/deliveries/page.tsx`)
- `0f50c15` (2026-10-27): *Refine error and not-found fallback pages*
- `fda97da` (2026-10-25): *Harden dashboard date picker accessibility*
- `c81df97` (2026-10-24): *Update RouteX pages, date picker, and project docs*
- `e011241` (2026-10-17): *Initialize Next.js project*
- `56dcb6e` (2026-10-17): *Add README.md*
- `a28030f` (2026-10-13): *Initial commit*

### 20.2 Key Application Source Files Examined
- **Config & Manifests:** [package.json](file:///c:/Users/suchi/Documents/rrli/package.json), [next.config.ts](file:///c:/Users/suchi/Documents/rrli/next.config.ts), [tsconfig.json](file:///c:/Users/suchi/Documents/rrli/tsconfig.json), [.env.example](file:///c:/Users/suchi/Documents/rrli/.env.example), [AGENTS.md](file:///c:/Users/suchi/Documents/rrli/AGENTS.md).
- **Proxy & Auth:** [src/proxy.ts](file:///c:/Users/suchi/Documents/rrli/src/proxy.ts), [src/features/auth/auth-model.ts](file:///c:/Users/suchi/Documents/rrli/src/features/auth/auth-model.ts), [src/lib/auth/preview-session.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/auth/preview-session.ts), [src/lib/auth/route-policy.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/auth/route-policy.ts), [src/app/api/preview-session/route.ts](file:///c:/Users/suchi/Documents/rrli/src/app/api/preview-session/route.ts), [src/app/login/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/login/page.tsx).
- **Supabase & Env:** [src/lib/config/env.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/config/env.ts), [src/lib/supabase/browser.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/supabase/browser.ts), [src/lib/supabase/server.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/supabase/server.ts), [src/lib/supabase/proxy.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/supabase/proxy.ts), [src/lib/errors/app-error.ts](file:///c:/Users/suchi/Documents/rrli/src/lib/errors/app-error.ts).
- **App Shell & Components:** [src/app/layout.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/layout.tsx), [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css), [src/components/operational-sidebar.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/operational-sidebar.tsx), [src/components/sidebar-state-model.ts](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state-model.ts), [src/components/operational-topbar.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/operational-topbar.tsx), [src/components/global-date-range.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/global-date-range.tsx), [src/components/record-detail-drawer.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/record-detail-drawer.tsx), [src/components/rounded-select.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/rounded-select.tsx), [src/components/sortable-table-header.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/sortable-table-header.tsx), [src/components/truck-profile-page.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/truck-profile-page.tsx), [src/components/truck-photo-manager.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/truck-photo-manager.tsx), [src/components/audit-trail-preview.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/audit-trail-preview.tsx).
- **Feature Pages & Fixtures:** [src/app/dashboard/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/dashboard/page.tsx), [src/features/dashboard/dashboard-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/dashboard/dashboard-preview-data.ts), [src/app/deliveries/new/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/deliveries/new/page.tsx), [src/features/deliveries/delivery-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/deliveries/delivery-local-preview.ts), [src/app/fleet/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/fleet/page.tsx), [src/app/fleet/new/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/fleet/new/page.tsx), [src/app/fleet/[truckId]/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/fleet/%5BtruckId%5D/page.tsx), [src/features/fleet/fleet-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/fleet/fleet-preview-data.ts), [src/app/transactions/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/transactions/page.tsx), [src/app/transactions/new/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/transactions/new/page.tsx), [src/features/transactions/transaction-local-preview.ts](file:///c:/Users/suchi/Documents/rrli/src/features/transactions/transaction-local-preview.ts), [src/app/reports/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/reports/page.tsx), [src/features/reports/report-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/reports/report-preview-data.ts), [src/app/administration/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/administration/page.tsx), [src/features/audit/audit-preview-data.ts](file:///c:/Users/suchi/Documents/rrli/src/features/audit/audit-preview-data.ts), [src/app/settings/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/settings/page.tsx).

### 20.3 Knowledge Base, Architecture & Codex History Sources
- **Architecture Blueprint:** [RouteX Architecture Blueprint v1.md](file:///c:/Users/suchi/Documents/rrli/RouteX%20Architecture%20Blueprint%20v1.md)
- **Knowledge Base ADRs:** [ADR-001](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/06-Decisions/ADR-001-Post-Delivery-Scope.md), [ADR-002](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/06-Decisions/ADR-002-Stack-NextJS-Supabase-AuthJS.md), [ADR-003](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/06-Decisions/ADR-003-Dark-Industrial-UI-Direction.md), [ADR-004](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/06-Decisions/ADR-004-Role-Based-Access-and-Admin-Separation.md), [ADR-005](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/06-Decisions/ADR-005-Expense-Separation-and-No-Double-Counting.md), [ADR-006](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/06-Decisions/ADR-006-Preserve-History-Void-Reversal-Deactivation.md).
- **Canonical Feature Spec & Clarifications (`ACL-01`–`ACL-13`):** [RouteX_Feature_Spec_and_Access_Control.md](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/09-References/Canonical-Documents/Working-References/RouteX_Feature_Spec_and_Access_Control.md).
- **Issues & Open Questions Logs:** [Issues-and-TODOs.md](file:///c:/Users/suchi/Documents/rrli/RouteX-Knowledge-Base/08-Logs/Issues-and-TODOs.md) (`KB-001`–`KB-025`), [12-decisions-and-open-questions.md](file:///c:/Users/suchi/Documents/rrli/RouteX_Codex_Development_Kit/docs/12-decisions-and-open-questions.md) (`D-001`–`D-020`), [13-progress-and-handoff.md](file:///c:/Users/suchi/Documents/rrli/RouteX_Codex_Development_Kit/docs/13-progress-and-handoff.md), [16-codebase-study-2026-10-26.md](file:///c:/Users/suchi/Documents/rrli/RouteX_Codex_Development_Kit/docs/16-codebase-study-2026-10-26.md).
- **Codex IDE Extension Session Logs:** `C:\Users\suchi\.codex\session_index.jsonl` and `C:\Users\suchi\.codex\sessions\2026\10\23\rollout-2026-10-23T20-12-42-01a16876-8e64-7f13-85ab-0ee2a05351a0.jsonl` (verified through `2026-10-29T15:31:15.088Z`).
