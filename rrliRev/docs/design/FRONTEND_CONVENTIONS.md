# RouteX Frontend Architecture & Coding Conventions

> **Scope:** Directory organization, component boundaries, CSS authoring rules, state synchronization, return context patterns, and testing conventions for the RouteX frontend.  
> **Master Philosophy:** [`DESIGN_PHILOSOPHY.md`](./DESIGN_PHILOSOPHY.md)  
> **Last Verified & Audited:** November 2026

---

## 1. Directory Structure & Architectural Boundaries

RouteX uses the **Next.js App Router** (`src/app/`) with **React 19** and **TypeScript**, organized into route groups, reusable UI primitives, domain feature logic, and cross-cutting libraries:

```text
rrliRev/src/
├── app/                              # Next.js App Router entrypoints & global styles
│   ├── (auth)/                       # Unauthenticated route group
│   │   └── login/                    # Split-screen credentials & recovery route
│   ├── (workspace)/                  # Authenticated operational workspace route group
│   │   ├── dashboard/                # Executive overview, KPIs, and recent deliveries
│   │   ├── deliveries/               # Deliveries ledger, filters, and requests queue
│   │   │   ├── [id]/                 # Dedicated full-page delivery inspection & navigator
│   │   │   ├── [id]/edit/            # Delivery editing route
│   │   │   ├── new/                  # Delivery recording form (locations & expenses)
│   │   │   └── import/               # Excel spreadsheet delivery bulk importer
│   │   ├── truck-profitability/      # Fleet performance and truck profitability ledger
│   │   │   └── [plate]/              # Dedicated truck unit-economics profile
│   │   ├── drivers/                  # Fleet crew registry (drivers and helpers)
│   │   ├── finance/                  # Company operating expense ledger & 6-sheet import
│   │   │   └── import/               # Legacy finance workbook importer
│   │   ├── pod-documents/            # Proof-of-delivery document compliance inspector
│   │   ├── reports/                  # Daily trip reports, templates, and export console
│   │   ├── settings/                 # Account profile, photo, & credentials management
│   │   └── user-management/          # Staff provisioning & immutable audit logs (Admin)
│   ├── api/                          # Next.js Server Route Handlers
│   │   ├── audit/                    # Audit event querying
│   │   ├── auth/                     # Session, login, logout, password recovery
│   │   ├── deliveries/               # Delivery CRUD, documents, import, and requests
│   │   ├── drivers/                  # Fleet crew status and registration
│   │   ├── finance/                  # Company expenses CRUD and import
│   │   ├── reports/                  # Report templates persistence
│   │   ├── trucks/                   # Truck registration and deletion
│   │   └── users/                    # User account provisioning, roles, and status
│   └── globals.css                   # Single authoritative stylesheet for tokens & components
├── components/                       # Shared application shell and reusable UI primitives
│   ├── operational-sidebar.tsx       # Collapsible navigation rail (expanded/collapsed states)
│   ├── operational-topbar.tsx        # Top bar with GlobalDateRangePicker & AccountControl
│   ├── global-date-range-picker.tsx  # Workspace date range filter (presets + calendar)
│   ├── table-pagination.tsx          # Page-number input pagination primitive
│   ├── search-buffer.tsx             # Debounced search input with buffering indicator
│   ├── delivery-filter-dropdown.tsx  # Multi-select client & truck filter dropdown
│   ├── backdating-tickets-modal.tsx  # Backdating requests queue dialog
│   ├── rounded-select.tsx            # Custom accessible dropdown select
│   └── sortable-table-header.tsx     # Three-state column sorting header
├── features/                         # Domain data models, pure calculation helpers, and repository logic
│   ├── audit/                        # Audit event formatting and UI state transformers
│   ├── deliveries/                   # Delivery domain models, validation, mock database, server repository
│   │   ├── delivery-domain.ts        # Pure calculation engine (revenue, expenses, net profit, margin)
│   │   ├── small-mock-database.ts    # Seeded fixture database for browser preview mode
│   │   ├── truck-registry.ts         # Truck fleet catalog and capabilities
│   │   └── driver-registry.ts        # Fleet crew catalog (drivers and helpers)
│   ├── finance/                      # Company expense models, 6-sheet parser, duplicate review
│   ├── reports/                      # Report template definitions, aggregation, and Excel CSV generator
│   └── users/                        # User profile photo helpers and settings logic
└── lib/                              # Cross-cutting utilities & infrastructure
    ├── auth/                         # RBAC rules, session guards, password policies, Argon2id hashing
    ├── navigation/                   # Return context preservation (withReturnContext)
    ├── format/                       # Currency (PHP), percentage, and date formatters
    └── supabase/                     # Supabase client boundaries (browser & server SSR)
```

---

## 2. Navigation & Return Context Preservation

When navigating between ledger tables, detail pages (`/deliveries/[id]`), and creation forms:
- Use `withReturnContext(targetUrl, currentUrl, label)` from `src/lib/navigation/return-context.ts`.
- Encodes the origin URL, return label, active search query, filters, and page index.
- Detail and edit pages read `returnTo` and `returnLabel` to render a clean `← Back to [Label]` link, seamlessly returning dispatchers to their exact scroll and filter position.

---

## 3. Styling & Cascade Rules

- **Single Global Stylesheet (`src/app/globals.css`):** All component classes, design tokens, layout grids, and dark theme overrides are authored in `globals.css`.
- **Prohibition of CSS Modules (`*.module.css`):** CSS Modules are strictly prohibited due to Turbopack bundler requirements in Next.js 16.
- **Semantic Class Naming:** Use clear, hyphenated class names (`.records-card`, `.stat-card`, `.primary-action-button`, `.secondary-button`, `.routex-badge`).

---

## 4. State Synchronization in Preview Mode

In browser preview mode:
- Local mutations save to `localStorage` and broadcast custom DOM events (`ROUTEX_DELIVERIES_CHANGED`, `ROUTEX_COMPANY_EXPENSES_CHANGED`, `BROWSER_PREVIEW_TRUCKS_CHANGED`).
- Components listen to these events to synchronize state seamlessly across tabs and views without requiring manual page refreshes.
