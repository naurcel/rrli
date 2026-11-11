# Knowledge Base: 02 — System Architecture

> **Document Status:** `[Implemented]`  
> **Authority Level:** Authoritative Specification  
> **Last Verified:** November 2026  
> **Location:** `rrliRev/docs/knowledge-base/02-system-architecture.md`

---

## 1. High-Level Architectural Model

RouteX is constructed as a modern, monolithic Next.js 16 full-stack web application running on React 19 and TypeScript. The architecture adheres to a clean separation between Presentation, Domain, Security, and Data Access layers.

```mermaid
flowchart TD
    Client["Client Browser\n(React 19 Server & Client Components)"]
    
    subgraph AppRouter["Next.js App Router (rrliRev/src/app)"]
        Layout["(workspace)/layout.tsx\nWorkspaceShellLayout"]
        Routes["Routes (/deliveries, /trucks, /finance, /reports, etc.)"]
        API["Route Handlers (/api/*)"]
    end

    subgraph Security["Security & Access Layer (rrliRev/src/lib/auth)"]
        SessionGuard["Session Guard\n(HMAC-SHA256 Token)"]
        RBAC["RBAC Policy\n(6 Canonical Roles)"]
        Argon2["Argon2id Password & Answer Hashing"]
    end

    subgraph Domain["Domain & Service Layer (rrliRev/src/features)"]
        DeliveryDomain["Delivery & Drop-off Domain"]
        FinanceDomain["Company Expense Domain"]
        ReportEngine["Report Generation Engine"]
    end

    subgraph StorageAdapters["Dual-Mode Storage Abstraction"]
        direction TB
        PreviewAdapter["Browser Preview Adapter\n(small-mock-database.ts + localStorage)"]
        SupabaseAdapter["Supabase PostgreSQL Adapter\n(Server Client + RLS + Storage)"]
    end

    Client --> Layout --> Routes
    Routes --> Domain
    Routes --> Security
    API --> Security --> Domain
    Domain --> StorageAdapters
```

---

## 2. Layered Structure & Responsibilities

### Presentation Layer (`src/app/` & `src/components/`)
- **App Router Layouts:** `src/app/(workspace)/layout.tsx` wraps all authenticated routes within `<WorkspaceShellLayout />`, which mounts the sticky resizable `<OperationalSidebar />`, the shared `<RouteXFooter />`, and the `<InitialSetupModal />`.
- **Topbars & Chrome:** Every workspace page mounts `<OperationalTopbar />` with dynamic context labels, date picker integration, and action buttons.
- **Client Primitives:** Reusable controls in `src/components/` (`RoundedSelect`, `TablePagination`, `GlobalDateRangePicker`, `DeliveryFilterDropdown`, `EditDeliveryModal`, `DeliveryNavigator`).
- **Styling Architecture:** Single unified global stylesheet in `src/app/globals.css`. CSS Modules (`*.module.css`) are strictly prohibited due to Turbopack bundler requirements.

### Security & Authentication Layer (`src/lib/auth/`)
- **Session Tokens:** Stateless, cryptographically signed HMAC-SHA256 tokens stored in the secure HTTP-only cookie `routex_session_token`.
- **Role-Based Access Control:** `src/lib/auth/rbac.ts` evaluates permissions (`canMutateDeliveryRecords`, `canManageCompanyExpenses`, `canManageUsers`, etc.) across three access levels: `admin`, `operations`, and `view_only`.
- **Server Route Protection:** Server component pages execute `requireAuthenticatedActor()` to prevent unauthorized rendering, while `/api/*` handlers return 401 or 403 responses.

### Domain & Business Logic Layer (`src/features/`)
- **Delivery Domain (`src/features/deliveries/`):** Encapsulates delivery calculation rules, drop-off timelines, POD verification derivation, fuel cost algorithms, and financial completeness evaluation (`isDeliveryIncomplete`, `isDeliveryFinanciallyComplete`).
- **Finance Domain (`src/features/finance/`):** Manages company-wide operating expenses, date range filtering, and company net profit aggregation.
- **Reports Engine (`src/features/reports/`):** Transforms delivery and expense datasets into structured report tables (Client Summary, Truck Summary, Trip Ledger, Daily Trip Report) and formats compliant CSV documents.

### Data Access Layer & Dual-Mode Abstraction
RouteX isolates database dependencies behind repository contracts:
- [`src/features/deliveries/server/delivery-repository.ts`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/features/deliveries/server/delivery-repository.ts)
- [`src/features/finance/server/company-expense-repository.ts`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/features/finance/server/company-expense-repository.ts)
- [`src/lib/auth/server-account-store.ts`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/lib/auth/server-account-store.ts)
- [`src/lib/audit/server-audit-store.ts`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/lib/audit/server-audit-store.ts)

When Supabase environment variables are missing, the repositories automatically route calls to `small-mock-database.ts` and browser storage without throwing connection errors.

---

## 3. Data Flow Diagrams

### A. Delivery Creation & Financial Completion Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Dispatcher / Admin
    participant UI as Record Delivery Form (/deliveries/new)
    participant Policy as Recording Policy
    participant Domain as Delivery Domain
    participant Repo as Delivery Repository
    participant Store as Browser / PostgreSQL Storage

    User->>UI: Enter trip details (Waybill, Date, Client, Drop-offs, Expenses)
    UI->>Policy: Validate 3-day window & 2024 boundary
    alt Date earlier than 2024-01-01
        Policy-->>UI: Reject: Foundation boundary error
    else Operations user exceeds 3 days
        Policy-->>UI: Reject: 3-day operational window exceeded
    else Validated
        Policy-->>UI: Permitted
    end

    UI->>Domain: Evaluate completeness (check unknown expenses & PODs)
    alt Any expense state == "unknown" or missing PODs
        Domain-->>UI: financialState = "incomplete"
    else All expenses confirmed / N/A and PODs submitted
        Domain-->>UI: financialState = "finalized"
    end

    UI->>Repo: upsertDeliveryRecord(payload)
    Repo->>Store: Save delivery + emit audit log
    Store-->>Repo: Saved record
    Repo-->>UI: Success
    UI-->>User: Redirect to /deliveries/[id]
```

### B. Profitability Aggregation Flow

```mermaid
flowchart TD
    AllDeliveries["All Recorded Deliveries"] --> Filter["Filter by Selected Date Range"]
    Filter --> Split{"Check Financial State"}
    
    Split -- "incomplete" --> IncompleteTrips["Incomplete Trips Ledger\n(Displayed with Incomplete Badges)"]
    Split -- "finalized" --> FinalizedTrips["Confirmed Operational Deliveries"]
    
    FinalizedTrips --> SumRev["Sum Delivery Revenue (₱)"]
    FinalizedTrips --> SumExp["Sum Trip Expenses (₱)\n(Fuel + Tolls + Fees + Crew)"]
    
    SumRev --> DeliveryProfit["Delivery Net Profit\n(Revenue - Expenses)"]
    SumExp --> DeliveryProfit
    
    DeliveryProfit --> TruckProfit["Truck Profitability Engine\n(Aggregated by Plate Number)"]
    
    CompanyExpenses["Company Expenses Ledger\n(Entered via /finance)"] --> CompanyFinance["Company Profitability Engine"]
    SumRev --> CompanyFinance
    SumExp --> CompanyFinance
    CompanyFinance --> CompanyProfit["Company Net Profit =\nDelivery Revenue - Delivery Expenses - Company Expenses"]
    
    IncompleteTrips -.-> PendingBadge["+ ₱X pending indicator\n(Truck Profile only, excluded from totals)"]
```

---

## 4. Deployment & Runtime Architecture

- **Runtime Target:** Node.js (v20+) or Vercel Serverless environment.
- **Build Engine:** Next.js Turbopack (`next build`).
- **Database Engine:** Supabase PostgreSQL with automated migrations in `rrliRev/supabase/migrations/`.
- **Object Storage:** Supabase Storage (private bucket `routex-documents`).
