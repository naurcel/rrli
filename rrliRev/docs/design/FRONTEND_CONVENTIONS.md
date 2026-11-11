# RouteX Frontend Architecture & Coding Conventions

> **Scope:** This document defines the frontend folder organization, component boundaries, CSS authoring rules, browser-local state synchronization patterns, accessibility requirements, and unit testing conventions for RouteX. Follow these conventions whenever building or modifying any part of the RouteX frontend.

---

## 1. Directory Structure & Architectural Boundaries

RouteX uses the **Next.js App Router** (`src/app/`) with **React 19** and **TypeScript**, organized cleanly into route groups, reusable UI primitives, domain feature logic, and cross-cutting libraries:

```text
rrliRev/src/
├── app/                              # Next.js App Router entrypoints & global styles
│   ├── (auth)/                       # Unauthenticated route group
│   │   └── login/                    # Split-screen credentials & recovery route
│   ├── (workspace)/                  # Authenticated operational workspace route group
│   │   ├── dashboard/                # Executive overview, KPIs, and recent deliveries
│   │   ├── deliveries/               # Deliveries ledger, detail drawer, and filters
│   │   │   ├── new/                  # Multi-step delivery recording wizard
│   │   │   └── import/               # Excel spreadsheet bulk delivery importer
│   │   ├── truck-profitability/      # Fleet performance, owned trucks, subcontracted trucks, and crew
│   │   │   └── [plate]/              # Dedicated truck unit-economics profile & history
│   │   ├── pod-documents/            # Proof-of-delivery document compliance & inspector
│   │   ├── reports/                  # Report templates engine, daily trip report, and CSV export
│   │   ├── settings/                 # Account profile & credentials self-management
│   │   └── user-management/          # Authorized staff provisioning & immutable audit logs (Admin)
│   ├── api/                          # Next.js Server Route Handlers
│   │   ├── audit/                    # Audit event querying
│   │   ├── auth/                     # Session, login, logout, password recovery
│   │   ├── deliveries/               # Delivery CRUD, documents, import, and summaries
│   │   ├── drivers/                  # Fleet crew status and registration
│   │   ├── reports/                  # Custom report template persistence
│   │   ├── trucks/                   # Truck registration and deletion
│   │   └── users/                    # User account provisioning, roles, and status
│   └── globals.css                   # Single authoritative stylesheet for tokens, shell, and components
├── components/                       # Shared application shell and reusable UI primitives
│   ├── operational-sidebar.tsx       # Collapsible navigation rail (expanded/collapsed states)
│   ├── operational-topbar.tsx        # Top bar with GlobalDateRangePicker & AccountControl
│   ├── global-date-range-picker.tsx  # Workspace date range filter (defaults to "All Time")
│   ├── table-pagination.tsx          # Page-number input pagination primitive
│   ├── delivery-filter-dropdown.tsx  # Multi-select client & truck filter dropdown
│   ├── truck-filter-dropdown.tsx     # Fleet classification & performance filter dropdown
│   ├── delivery-dropoff-timeline.tsx # Store drop-off sequence & POD badge timeline
│   ├── delivery-financial-breakdown.tsx # Unit economics & expense attribution cards
│   ├── delivery-pod-documents.tsx    # Inline document upload and viewing
│   ├── record-detail-drawer.tsx      # Slide-over record inspection panel
│   ├── rounded-select.tsx            # Custom accessible dropdown select
│   └── sortable-table-header.tsx     # Three-state column sorting header
├── features/                         # Domain data models, pure calculation helpers, and repository logic
│   ├── audit/                        # Audit event formatting and UI state transformers
│   ├── deliveries/                   # Delivery domain models, validation, mock database, server repository
│   │   ├── delivery-domain.ts        # Pure calculation engine (revenue, expenses, net profit, margin)
│   │   ├── small-mock-database.ts    # Seeded fixture database for offline demo mode
│   │   ├── truck-registry.ts         # Truck fleet catalog and capabilities
│   │   ├── driver-registry.ts        # Fleet crew catalog (drivers and helpers)
│   │   └── server/                   # Server-only delivery repository adapters
│   ├── reports/                      # Report template definitions, aggregation, and Excel CSV generator
│   └── users/                        # User profile photo helpers and settings logic
└── lib/                              # Cross-cutting utilities & infrastructure
    ├── auth/                         # RBAC rules, session guards, password policies, Argon2id hashing
    ├── config/                       # Environment variable validation
    ├── format/                       # Currency (PHP), percentage, and date formatters
    └── supabase/                     # Supabase client boundaries (browser & server SSR)
```

### Separation of Responsibilities

1. **Route Pages (`src/app/**/page.tsx`):**
   - Compose the application shell (`<OperationalSidebar />`, `<OperationalTopbar />`, `<main className="main">`) and wire page-level filter state (`useState`, `useMemo`) to shared components.
   - Interactive workspace pages declare `"use client";` at line 1.
   - Must **not** embed complex financial aggregation formulas or raw `localStorage` serialization inline; delegate those to `src/features/*`.
2. **Shared UI Components (`src/components/*.tsx`):**
   - Implement reusable visual primitives and shell chrome (`OperationalSidebar`, `OperationalTopbar`, `GlobalDateRangePicker`, `RoundedSelect`, `SortableTableHeader`, `RecordDetailDrawer`, `AccountControl`, `ThemeToggle`, `MouseReactiveShadows`, `TruckProfilePage`, `TruckPhotoManager`, `AuditTrailPreview`, `Icon`).
   - Accept typed props and callbacks without hardcoding module-specific business logic.
   - Extract pure state transitions (such as sidebar collapse/toggle state or table sort state) into companion pure TypeScript modules (`sidebar-state-model.ts`, `table-sorting.ts`) so they can be unit-tested in Node without a DOM runner.
3. **Feature Modules (`src/features/<domain>/`):**
   - Own domain TypeScript interfaces, seed/preview datasets, pure filtering/KPI calculation functions, and browser-local storage adapters (`*-local-preview.ts`).
   - Every pure calculation or storage module should have a co-located `*.test.ts` file verified via `npm test`.
4. **Shared Utilities (`src/lib/`):**
   - Formatting helpers (`src/lib/preview/format.ts` for `formatPeso`), route access policies (`src/lib/auth/`), and Supabase/environment configuration (`src/lib/supabase/`).

---

## 2. Styling Architecture & `globals.css` Conventions

### Why RouteX Uses a Single Global Stylesheet (`src/app/globals.css`)

- RouteX imports Tailwind v4 (`@import "tailwindcss";`) at the top of [`src/app/globals.css`](../../src/app/globals.css) for CSS reset normalization, but **all visual design tokens, layout grids, glassmorphism surfaces, dark mode overrides, and component rules are authored in semantic CSS classes inside `src/app/globals.css`**.
- **Do not use CSS Modules (`*.module.css`)** in this repository: under the project's Next.js 16 Turbopack configuration, CSS Module imports previously returned empty class mappings (`{}`), causing unstyled markup.
- **Do not scatter inline Tailwind utility chains across JSX** or use inline `style={{ ... }}` objects for static styling. Keep JSX `className` attributes clean, semantic, and aligned with the established class vocabulary (`.records-card`, `.records-heading`, `.stat-card`, `.primary-button`, `.secondary-button`, `.filter-button`, `.rounded-select`, etc.).

### Class Naming Conventions

RouteX uses descriptive, hyphen-delimited class names organized around component families:

- **Layout & Shell:** `.app-shell`, `.sidebar`, `.sidebar-collapsed`, `.main`, `.topbar`, `.page-intro`, `.route-transition-shell`
- **Shared Cards & Containers:** `.records-card`, `.records-heading`, `.stat-card`, `.stat-label`, `.stat-meta`, `.notice`, `.empty-state`, `.scope-note`
- **Controls & Inputs:** `.primary-button`, `.secondary-button`, `.filter-button`, `.export-button`, `.search-box`, `.rounded-select`, `.rounded-select-trigger`, `.rounded-select-menu`, `.global-date-filter`
- **Status & Feedback:** `.pod-status.attached`, `.pod-status.missing`, `.detail-status.success`, `.detail-status.warning`, `.fleet-status.inactive`, `.form-error`, `.login-error`
- **Module-Scoped Prefixes:** When a layout or sub-component is specific to one domain, prefix its class with the domain noun (`.dashboard-*`, `.delivery-*`, `.fleet-*`, `.truck-profile-*`, `.report-*`, `.hr-*`, `.settings-*`, `.login-*`).

### Navigating & Maintaining `src/app/globals.css`

#### Existing Implementation Structure (Cascade History)

Because [`src/app/globals.css`](../../src/app/globals.css) evolved across multiple visual refinement passes, styles are currently layered in chronological blocks across its lines:

| Line Range | Block Purpose | Important Cascade Behavior to Know |
| :--- | :--- | :--- |
| **Lines 1–53** | Initial token scaffold & base layout | Defines early `--bg`, `--surface`, `--accent`, `.app-shell`, `.sidebar`, `.main`, `.topbar`, `.stat-card`, `.records-card`, and base table rules |
| **Lines 54–105** | Neumorphic surface pass & secondary pages | Introduces early `--bg-canvas`, `--shadow-raised-*`, `.fleet-grid`, `.report-grid`, `.login-page`, `.fallback-page` |
| **Lines 106–184** | Warm glassmorphism & amber accent pass | **Overrides** `:root` tokens to the warm cream/amber palette (`--color-accent: #e06414`), adds `.page-intro h1` and `.records-heading h2` amber text-clip gradients, and refines `.stat-card` radial corner glows |
| **Lines 185–323** | Interactive popovers, drawer, & login refinement | Styles `.date-picker-popover`, `.record-detail-drawer`, `.preview-create-card`, `.account-menu-popover`, `.rounded-select`, and `.login-card` (`1040px` split layout) |
| **Lines 324–449** | Shell collapse, topbar alignment, & responsive passes | Styles `.sidebar-collapsed`, `.sidebar .nav-item.active::before`, `.route-transition-shell`, and media queries |
| **Lines 450–473** | Dark mode token & surface overrides | Defines `html[data-theme="dark"]` variables and dark glass overrides |
| **Lines 475–686** | Feature polish, theme toggle, & module workflows | Styles `.theme-toggle`, `.truck-profile-*`, `.delivery-create-*`, `.hr-*`, `.settings-*`, `.minimal-not-found`, and dark-mode refinements for new components |

#### Rules for Modifying `globals.css`

1. **Inspect All Occurrences Before Editing a Selector:** Before changing a core selector (such as `.records-card`, `.stat-card`, `.sidebar`, `.page-intro h1`, or `.records-heading h2`), search for every occurrence of that selector across `src/app/globals.css` so you update the active rule rather than an earlier overridden block.
2. **Always Pair Light & Dark Mode Rules:** Any new surface, border, text color, or status badge added to `globals.css` must either reference semantic variables (`var(--color-text-primary)`, `var(--color-border-subtle)`, `var(--color-accent-soft)`) or include a matching `html[data-theme="dark"]` rule.
3. **Avoid New `!important` Declarations:** Outside of the existing `.dashboard-welcome h1` override and `@media (prefers-reduced-motion: reduce)` reset, do not introduce `!important`. Resolve specificity by placing rules in the appropriate cascade section or consolidating duplicate selectors.

> **Recommendation (Future CSS Cleanup):** In a dedicated maintenance pass, consolidate the duplicate `:root` blocks (lines 3, 55, and 107) and duplicate `.records-card` / `.stat-card` / `.sidebar` blocks into single canonical definitions per selector while verifying zero visual diffs across light and dark themes.

---

## 3. Component Authoring Patterns

### A. Custom Interactive Primitives Over Unstyled Native Popups

Never render raw `<select>` elements or browser `window.alert()` / `window.confirm()` dialogs in RouteX:

- **Single-Value Selection:** Always use [`<RoundedSelect />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/rounded-select.tsx) (`src/components/rounded-select.tsx`).
- **Multi-Select Filtering:** Always use [`<DeliveryFilterDropdown />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/delivery-filter-dropdown.tsx) or [`<TruckFilterDropdown />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/truck-filter-dropdown.tsx).
- **Table Pagination:** Always use [`<TablePagination />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/table-pagination.tsx) (`5` items for Dashboard, `10` items for all other tables).
- **Date Range Filtering:** Always use [`<GlobalDateRangePicker />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/global-date-range-picker.tsx) inside `<OperationalTopbar />`.
- **Sortable Table Columns:** Always use [`<SortableTableHeader />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/sortable-table-header.tsx).
- **Record Inspection:** Always use [`<RecordDetailDrawer />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/record-detail-drawer.tsx) to inspect row details without navigating away from the table context.
- **Route & Store Drop-offs:** Always use [`<DeliveryDropoffTimeline />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/delivery-dropoff-timeline.tsx) to display stop sequence and POD badges.
- **Financial Breakdown:** Always use [`<DeliveryFinancialBreakdown />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/delivery-financial-breakdown.tsx) for single delivery unit economics, and [`<AggregateExpenseBreakdown />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/delivery-financial-breakdown.tsx) for aggregate ledger summaries.
- **Audited Deletions:** Always use [`<ConfirmDeliveryDeletionDialog />`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/confirm-delivery-deletion-dialog.tsx) or the truck deletion dialog instead of browser confirm dialogs.

### B. Popover Dismissal & Keyboard Escape Pattern

Whenever creating or extending a floating UI element (popover, dropdown menu, slide-over drawer), implement all three dismissal triggers inside a `useEffect` hook while the overlay is open:

1. **Outside Pointer Click:** Listen for `mousedown` on `document` (`window` for drawers backdrop click) and close if `!containerRef.current?.contains(event.target as Node)`.
2. **Keyboard Escape:** Listen for `keydown` (`event.key === "Escape"`) and close the overlay immediately.
3. **Scroll / Resize Repositioning (for portal popovers):** Listen for `window` `resize` and `scroll` (with capture `true`) to recompute viewport-clamped coordinates.

### C. SVG Iconography (`src/components/route-x-ui.tsx`)

All UI icons are rendered via the shared `<Icon name="..." />` component in [`src/components/route-x-ui.tsx`](../../src/components/route-x-ui.tsx):

- Uses `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="1.9"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, and `aria-hidden="true"`.
- When adding a new icon to RouteX, extend the `IconName` union type and `<Icon />` switch in `src/components/route-x-ui.tsx` using the same `24×24` grid and `1.9` stroke weight rather than importing external icon packages or inline multi-color SVGs.

---

## 4. Browser State & Cross-Component Synchronization

RouteX persists user preferences and local preview records in `window.localStorage` and synchronizes live updates across mounted components via custom DOM events on `window`:

| State Domain | `localStorage` Key | Custom Window Event | Source Module |
| :--- | :--- | :--- | :--- |
| **Theme Mode** | `"routex-theme"` (`"light"` \| `"dark"`) | Direct `document.documentElement.dataset.theme` mutation | [`src/app/layout.tsx`](../../src/app/layout.tsx), [`src/components/theme-toggle.tsx`](../../src/components/theme-toggle.tsx) |
| **Sidebar Collapsed** | `"routex.sidebar.collapsed"` (`"1"` \| `"0"`) | React Context (`SidebarStateProvider`) | [`src/components/sidebar-state.tsx`](../../src/components/sidebar-state.tsx) |
| **Global Date Range** | `"routex-global-date-range-v1"` | `"routex-date-range-updated"` (`GLOBAL_DATE_RANGE_UPDATED_EVENT`) | [`src/components/global-date-range-picker.tsx`](../../src/components/global-date-range-picker.tsx) |
| **Delivery Preview Records** | `"routex-delivery-preview-records-v2"` | `"routex-delivery-preview-updated"` (`DELIVERY_PREVIEW_UPDATED_EVENT`) | [`src/features/deliveries/browser-preview-deliveries.ts`](../../src/features/deliveries/browser-preview-deliveries.ts) |
| **Company Expenses Preview** | `"routex-company-expenses-v1"` | `"routex-company-expenses-updated"` | [`src/features/finance/browser-preview-expenses.ts`](../../src/features/finance/browser-preview-expenses.ts) |
| **Fleet Custom Units** | `"routex-fleet-preview-trucks-v1"` | `"routex-fleet-preview-updated"` | [`src/features/deliveries/truck-registry.ts`](../../src/features/deliveries/truck-registry.ts) |
| **Fleet Profile Overrides & Photos** | `"routex-fleet-profile-custom-v1"` | `"routex-fleet-profile-updated"` (`FLEET_PROFILE_UPDATED_EVENT`) | [`src/components/truck-photo-storage.ts`](../../src/components/truck-photo-storage.ts) |

### Storage Safety Rules

1. **Always Wrap `localStorage` Access in `try / catch`:** Browser privacy modes, quota limits, or server-side prerendering can throw on `window.localStorage.getItem` / `setItem`. Always guard for `typeof window !== "undefined"` and fall back gracefully to default seed state.
2. **Dispatch Custom Events After Writes:** Whenever a local preview storage adapter writes or clears records, dispatch its corresponding `CustomEvent` on `window` AND subscribe to both that custom event and the native `"storage"` event in consuming components so KPIs, tables, and attention counters stay synchronized across routes and tabs.

---

## 5. Accessibility (a11y) Checklist

Every new or modified frontend component must satisfy these baseline accessibility conventions established in RouteX:

1. **Landmarks & Page Structure:**
   - Wrap the sidebar in `<aside className="sidebar" aria-label="Primary navigation">` containing `<nav className="nav">`.
   - Wrap the page content in `<main className="main">` with a single `<h1>` inside `<header className="page-intro">`.
2. **Interactive Semantics:**
   - Never attach `onClick` to a non-interactive `<div>` or `<span>` when a `<button type="button">` or `<Link>` can be used.
   - For interactive table rows (`<tr className="Interactive-row">`), provide keyboard activation (`tabIndex={0}` and `onKeyDown` handling for `Enter` / `Space`) or ensure the row action is reachable via a focusable button/link inside the row.
3. **ARIA Attributes on Custom Controls:**
   - Sidebar collapse toggle: `aria-expanded={!collapsed}`, `aria-label`.
   - Active navigation link: `aria-current="page"`.
   - Custom select trigger (`.rounded-select-trigger`): `aria-haspopup="listbox"`, `aria-expanded={open}`, `aria-label`.
   - Custom select menu (`.rounded-select-menu`): `role="listbox"`, options `role="option"` with `aria-selected`.
   - Filter popovers (`.more-filters-trigger`, `.global-date-filter`): `aria-expanded={open}`, `aria-haspopup="dialog"`, `aria-controls`.
   - Slide-over drawer (`.record-detail-drawer`): `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
   - Sortable column header (`<th>`): `aria-sort="ascending" | "descending" | "none"`.
   - Search inputs without visible `<label>` text: wrap in `<label>` with a `<span className="sr-only">` label AND provide `aria-label`.
   - Validation errors: `role="alert"`.
   - Notice banners & live counts: `role="status"` or `aria-live="polite"`.
4. **Reduced Motion Support:**
   - Any new CSS keyframe animation or transform transition must respect the global `@media (prefers-reduced-motion: reduce)` rule in `src/app/globals.css`.

---

## 6. Verification & Testing Conventions

Before completing any frontend modification in RouteX, verify the following checks:

1. **TypeScript Typecheck:**
   ```bash
   npx tsc --noEmit
   ```
   Must pass with zero errors.
2. **Unit Test Suite (`node --test`):**
   ```bash
   npm test
   ```
   All co-located `*.test.ts` suites (covering `sidebar-state-model`, `table-sorting`, `dashboard-preview-data`, `delivery-local-preview`, `transaction-local-preview`, `fleet-local-preview`, `reports-preview-data`, and auth/middleware policies) must pass.
3. **Pure Logic Extraction Rule:**
   Whenever introducing non-trivial UI state logic (e.g., new filter combinators, date-range comparisons, pagination math, or sorting comparators), write the logic as pure TypeScript functions in a `.ts` module without React/DOM imports and add a companion `.test.ts` file using `node:test` and `node:assert/strict`.
4. **Cross-Theme & Responsive Visual Check:**
   Verify every UI change in both **Light Mode** (`:root`) and **Dark Mode** (`html[data-theme="dark"]`), and across desktop (`> 1100px`), tablet (`<= 1100px`), and mobile (`<= 760px`) breakpoints.

