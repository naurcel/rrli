# RouteX Repository Audit

**Audit date:** 2026-10-25 (Asia/Seoul)  
**Branch:** `main`  
**Purpose:** Snapshot the live repository and identify the safest next implementation sequence. This is an evidence-based audit, not a production-readiness certification.

## Executive summary

RouteX currently runs as a Next.js preview application with eight user-facing routes and shared visual behavior. Its pages use local, hardcoded preview records and interface-only controls. There is no database, authentication provider, authorization enforcement, file storage, server API, migration history, broad application test suite, or lint script in the live project. A small dependency-free unit suite now covers the shared sidebar state model. The current pages demonstrate layout and some client-side filtering, but they are not production workflows.

The most important next step is an approved foundation/trust-boundary decision: select and document the database, authentication, storage, validation, and server-side authorization approach, and approve the access matrix and canonical core data model before connecting preview screens to persistent records. Financial, HR, report, and dashboard behavior depends on unresolved owner decisions recorded in `docs/12-decisions-and-open-questions.md`.

## Repository state and sources

- `git status --short --branch` reported branch `main`, tracking `origin/main`, with existing uncommitted changes in `src/app/globals.css`, `src/app/layout.tsx`, and untracked `src/components/mouse-reactive-shadows.tsx` at audit start. These were pre-existing session work and were preserved.
- The top-level `AGENTS.md`, development-kit `AGENTS.md`, README, development workflow, architecture, design, domain integrity, access/security, testing, decisions, module specifications, current roadmap, and progress log were inspected.
- The live framework rules under `node_modules/next/dist/docs/` were read for layouts/pages, CSS, and Server/Client Components before this documentation work.
- No prototype HTML file was found in the repository. A prototype path appears in prior documentation but is outside the live workspace.
- No `.env*` filename, database schema/migration directory, or app route handler was found in the repository file scan. No secret values were inspected.

## Verified technology stack

Evidence: `package.json`, `package-lock.json`, `next.config.ts`, `src/app/layout.tsx`, and `src/app/globals.css`.

- Next.js `16.4.2`, App Router.
- React and React DOM `19.3.0`.
- TypeScript `5.x` (manifest range `^5`; exact installed version is lockfile-defined).
- Tailwind CSS `4.x` with `@tailwindcss/turbopack` and a CSS `@import "tailwindcss"`; the visual system is mostly authored in `src/app/globals.css`.
- npm, lockfile version 3.
- Readex Pro is loaded from Google Fonts in the root document head.
- Next config enables `cacheComponents`, partial prefetching, React Compiler, experimental agent feedback, Turbopack CSS loading, and disables the development indicator.
- No shadcn/ui, Lucide, database client/ORM, Auth.js, Supabase, storage SDK, or validation library is declared in the application dependencies.

### Documentation discrepancy

The root `README.md` describes Next.js 15, shadcn/ui, Lucide, PostgreSQL/Supabase, Auth.js, Supabase Storage, Server Actions, and Vercel. Those are not present in the live dependencies/configuration. They are documented expectations only and must not be treated as the selected production architecture.

## Routes and implementation evidence

| Route | Live implementation | Verified behavior | Current status / limits |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Deliveries preview; local search and POD filter; static rows; empty state; resizable sidebar state saved to localStorage | Preview only. Creation/export disabled. No detail route, persistence, server validation, auth, loading, or async error state. |
| `/dashboard` | `src/app/dashboard/page.tsx` | Local dashboard preview with greeting, summary cards, recent rows, and attention items | Values are local preview fixtures and are not connected to a query or reports. Global search/date shown in page markup is not functional; date range picker does not update metrics. |
| `/fleet` | `src/app/fleet/page.tsx` | Owned-truck card grid and subcontracted-truck table, with locally rendered preview values | No persistent truck records or connected filtering/search. Add/export actions disabled. Financial figures are preview values, not approved calculations. |
| `/transactions` | `src/app/transactions/page.tsx` | Static local transaction table | No create/edit/reconcile behavior; export and actions unavailable. Categories and values are not backed by approved definitions or records. |
| `/reports` | `src/app/reports/page.tsx` | Static report-definition cards | No report query, export, scheduling, print generation, or permission checks. |
| `/administration` | `src/app/administration/page.tsx` | Static member/role preview table | No accounts, invitations, role changes, or access enforcement. Role names/content are presentational only. |
| `/settings` | `src/app/settings/page.tsx` | Static settings preview cards | Edit/save controls unavailable; no persistence or configuration service. |
| `/_not-found` | Next-generated behavior | Framework fallback route | No custom project not-found UI found. |

`/login` is an additional interface route, `src/app/login/page.tsx`. It presents a sign-in form but explicitly says authentication is not connected. Submitting navigates directly to `/dashboard`; this is a preview shortcut, not an authenticated session, and must not be represented as access protection.

## Shared structure, styling, and interaction

- Root document and metadata: `src/app/layout.tsx`.
- Global tokens, app shell styles, page styles, responsive rules, effects, and controls: `src/app/globals.css`.
- Shared icon wrapper: `src/components/route-x-ui.tsx`.
- Updated after this audit: `src/components/global-date-range-picker.tsx` now provides shared root date state and renders directly in `OperationalTopbar`, avoiding portal placement drift. Dated local preview records consume the selected range on Overview, Deliveries, and Transactions.
- Mouse-reactive shadows: `src/components/mouse-reactive-shadows.tsx` (uncommitted at audit start).
- Resolved after this audit: sidebar and top-bar markup are now centralized in `src/components/operational-sidebar.tsx` and `src/components/operational-topbar.tsx`. The outer page-shell composition remains route-local. Sidebar width/collapse persistence and pointer/keyboard resize behavior remain centralized in `src/components/sidebar-state.tsx`, with pure width rules in `src/components/sidebar-state-model.ts`; the provider persists across client route navigation.
- `globals.css` has accumulated appended overrides and repeated selectors from visual iteration. This is confirmed duplication/maintenance debt, but broad cleanup is not recommended until visual baselines and representative route checks exist.
- Light mode is implemented. No theme switch or dark theme implementation was found.
- No centralized component library beyond the small icon wrapper and global date picker was found. Utility CSS is available but the page styling is predominantly plain CSS.

### Date picker behavior and limits

The picker supports a two-click range, date-order normalization, same-day range, adjacent-month dates, month navigation, seven presets, Escape, outside-click close, trigger focus restoration, and initial focus inside the open dialog. Its range is held in component state only and does not notify a parent, update a URL, persist across navigation, or filter any page. “This Week” currently means Sunday through today; “This Month” means first of current month through today; “Last N Days” is inclusive of today. Those are implementation facts, not approved business/date conventions. Timezone and date boundary decisions remain open under D-016. The picker is hidden below the mobile breakpoint in current CSS. Calendar arrow-key navigation is not implemented.

## Data, authentication, authorization, and security

Verified absent in the live source/dependencies: schema, migrations, database connector, server data access, route handlers, server actions, auth/session provider, storage integration, permission middleware, and server-side authorization checks.

The visible lists, dashboard metrics, report definitions, and administration/settings content are local constants/preview fixtures in route components. Delivery page interactions operate on local client data. This makes them interface demonstrations only. No claim is made that their values reconcile with actual company records.

Security boundary: there is no authenticated boundary yet. UI-disabled controls do not provide authorization. `/login` navigation is not authentication. Do not add real sensitive data or expose this preview as a protected operational system until server-side authentication, authorization, and data access are approved and implemented.

## Module status versus the development kit

- Delivery Management: read-only preview list with local search/POD filtering; canonical fields/status, POD policy, create/edit/completion, history, and server authorization remain absent or undecided.
- Fleet Management: owned-truck card preview and subcontracted list; schema, truck details/history, status lifecycle, and authoritative financial values absent.
- Delivery Financials/Transactions: display-only fixture page; financial categories/formulas, source relations, correction history, and authorization are not implemented.
- HR/Compensation: no route or data model found.
- Profitability: no canonical analysis route/service; Dashboard/Fleet show preview figures, not approved metrics.
- Global Search: only a non-functional Dashboard global-search field; Delivery and Fleet tables have local fields, but Fleet search is not wired.
- Reports/Exports: report-definition preview only; no generated report or export.
- User/Access/Settings: preview pages only; no authentication, roles enforced, account lifecycle, or setting persistence.
- Dashboard: visible preview exists, contrary to the older roadmap’s “redirect/deferred” status; metrics are local fixtures and not reconciled.
- Cross-module integration: no persistent relationships or verified end-to-end flow.

The kit’s decisions D-002 through D-018 remain open or partially unresolved. Especially blocking are canonical fields/statuses, POD/storage policy, truck lifecycle, financial categories/rules, cost duplication/corrections, HR periods/rates, currency/timezone/rounding, role matrix, account/session lifecycle, report definitions, and dashboard metrics.

## State handling and responsive/accessibility findings

- Delivery has a local no-results/empty state. No async data means loading and network-error states are not represented on the preview pages.
- A custom root error boundary, not-found screen, or route loading UI was not found in `src/app`.
- Responsive CSS breakpoints exist in the global stylesheet; no browser/device verification was run in this audit.
- Some controls are intentionally disabled and labelled as preview-only. Several displayed controls (global search/date on Dashboard, Fleet table search/filter, row action buttons) are visual affordances without implemented behavior.
- The date picker now restores trigger focus on Escape/selection and focuses its selected date when opened. Full calendar arrow-key navigation is not implemented.
- Resolved 2026-10-28: all operational routes now use one shared sidebar, and its resizer exposes uniform pointer, keyboard, focus, and ARIA behavior.
- A visual screenshot/browser review was not performed as part of this audit.

## Automated checks available

From `package.json`, scripts are `dev`, `build`, `start`, `typecheck`, and `test`. The test script uses the installed Node.js test runner and TypeScript stripping, so no dependency was added. The current five tests cover sidebar saved-state normalization, clamping, collapse threshold, settled width, and keyboard targets. There is still no lint script, browser runner, or broad route/component test suite. A transitive Playwright package entry in the lockfile is not evidence of configured browser tests.

| Check | Result on 2026-10-25 |
|---|---|
| `cmd /c npm run typecheck` | Passed (exit 0). |
| `$env:NODE_OPTIONS='--max-old-space-size=4096'; cmd /c npm run build` | Passed (exit 0). Optimized production build completed; static routes generated for `/`, `/_not-found`, `/administration`, `/dashboard`, `/fleet`, `/login`, `/reports`, `/settings`, and `/transactions`. |
| `cmd /c npm test` | Passed: 5 tests, 0 failures. |
| HTTP route smoke check | Passed: all eight user-facing routes returned HTTP 200 from the production server on local port 3107. |
| Lint | Not configured; not run. |
| Browser/visual checks | No browser automation package is installed; visual interaction checks were not run. |

## Risks and priority recommendations

### Priority 1 — Trust boundary and canonical data decisions

Approve the intended database/auth/storage architecture, server validation approach, role matrix, account/session policy, and core delivery/truck/financial data definitions. Do not connect client fixtures to a production database before these boundaries are decided.

### Priority 2 — Establish an authenticated, server-authorized foundation

Choose one architecture, implement session handling and server-side authorization tests, then centralize the shell and data access conventions. Do not use the preview login redirect as authentication.

### Priority 3 — Delivery vertical slice

Use the delivery spec after the canonical schema and POD policy are approved. Add list/detail/form and state handling with audit/history behavior and permission tests.

### Priority 4 — Fleet and financial records

Connect fleet to historical deliveries, then implement source-traceable transactions after Finance approves categories, rates, date semantics, currency/rounding, correction behavior, and duplicate-cost prevention.

### Priority 5 — HR, search, reports, profitability, and dashboard

Implement only after their sensitive-field permissions, formulas, report definitions, searchable fields, and source data are approved. Dashboard should consume reconciled module services rather than maintain its own fixture metrics.

### Safe foundational follow-ups

- Sidebar and top-bar extraction were completed on 2026-10-28 with route-level HTTP, active-state, breadcrumb, and Dashboard-header checks. Responsive/accessibility review is the next frontend target before any broader shell extraction.
- Add date-picker interaction tests after specifying timezone/week-start semantics and controlled/apply behavior.
- Replace inert visual controls with either implemented interactions or clear disabled states, without inventing business workflows.
- Review and consolidate CSS overrides in a dedicated, visually verified styling task.

## Assumptions and limits

- Statements that a dependency, route handler, migration, or test file is “not found” are based on live package/source/repository scans performed on this branch; this is not a claim about external services or untracked infrastructure.
- Preview values are identified by their local constants and visible preview copy; they were not validated against an external source of truth.
- No database, authentication, financial, or permission behavior was executed because no such implementation exists locally.
- No files from the existing dirty worktree were reverted or cleaned up.
