# RouteX Page Development Roadmap

## Status

This roadmap was created after inspecting the live repository and the RouteX development kit on 2026-10-24. It is a proposal awaiting owner approval. No application-code changes are authorized by this roadmap alone.

Statuses used here: `Existing`, `Needs Audit`, `Planned`, `In Progress`, `Awaiting Review`, `Approved`, and `Blocked`.

## 1. Existing application condition

### Verified stack

- Next.js 16.4.2 App Router.
- React 19.3.0 and TypeScript 5.x.
- Tailwind CSS 4 with `@tailwindcss/turbopack`.
- npm with `package-lock.json`.
- No shadcn/ui, Lucide, database client, ORM, authentication provider, storage integration, API routes, server actions, test framework, or lint script found in the live repository.
- Available scripts are `dev`, `build`, and `start`.

### Current routes and implementation

| Route | Current state | Evidence | Roadmap status |
|---|---|---|---|
| `/` | Read-only Deliveries preview with search, POD filter, empty state, sample rows, fixed shell, resizable/collapsible sidebar, and current amber/glass/neomorphic styling | `src/app/page.tsx`, `src/app/globals.css` | `In Progress` |
| `/dashboard` | Temporary redirect to `/`; Dashboard intentionally deferred until source modules exist | `src/app/dashboard/page.tsx` | `Planned` |
| `/_not-found` | Next.js generated not-found route | Next build output | `Existing` |

The Deliveries preview uses local in-memory preview records. It is not production data and does not establish the final schema, permissions, status model, POD policy, or financial rules.

### Existing shared foundation

- Root layout and metadata: `src/app/layout.tsx`.
- Global tokens, typography, shell, responsive rules, glass/neomorphic surfaces, and table styling: `src/app/globals.css`.
- Minimal icon wrapper: `src/components/route-x-ui.tsx`.
- Current page-level shell and behavior remain concentrated in `src/app/page.tsx`; this is useful for the preview but should be split carefully before production modules expand.
- Readex Pro is loaded through an external stylesheet link because the offline build could not use `next/font/google`.
- Supplied Shinryu profile artwork is stored at `public/profiles/shinryu.png`.

## 2. Repository/documentation discrepancies

- The roadmap requested `CODEX_STEP_BY_STEP_APPROVAL_PROMPT.md` at the repository root, but the live file is located at `RouteX_Codex_Development_Kit/CODEX_STEP_BY_STEP_APPROVAL_PROMPT.md`.
- The documentation describes a possible Supabase/PostgreSQL/Auth.js/Storage/Vercel stack, but none of those technologies are present in the live repository. They must not be introduced without an approved architecture decision.
- The development kit describes a complete multi-module system, while the live repository currently contains only a preview Deliveries slice and a temporary `/dashboard` redirect.
- The prototype file referenced during the design work is external to this repository: `C:\Users\suchi\Documents\RouteX\RtX_-prototype-z.html`. It is a visual reference, not a data or permission specification.
- The current working tree already contains user/application/documentation changes. No reset, discard, commit, push, deploy, or destructive cleanup was performed.

## 3. Dependency-aware development sequence

### Stage 0 — Inspection, decisions, and roadmap

**Status:** `Awaiting Review`

Completed in this inspection:

- Verified branch `main` and the current working-tree changes.
- Inspected the actual package versions, routes, components, CSS, configuration, and available commands.
- Confirmed the absence of database, authentication, authorization, storage, API, tests, and lint infrastructure.
- Read the RouteX project brief, workflow, architecture, design, data-integrity, access-control, testing, change-management, decisions, handoff, and module specifications.
- Created this roadmap.

Approval needed: approve or revise this roadmap and the first implementation stage.

### Stage 1 — Application foundation and trust boundaries

**Status:** `Needs Audit`

This stage must come before production workflows even though much of the visual foundation already exists.

Scope:

- Confirm the route/layout convention and decide whether the current single-page preview shell should become a reusable application shell.
- Centralize shared navigation, page layout, table, filters, status, loading, empty, error, and permission-aware action patterns.
- Confirm the real database/provider, migration convention, authentication provider, session policy, storage approach, validation convention, and server-side authorization boundary.
- Resolve or explicitly defer the role matrix and account lifecycle rules before protected modules are built.
- Preserve the current amber/Readex Pro/glass-neomorphic direction as the shared visual foundation.

Dependencies: owner decisions D-001, D-012, D-017, D-018, and D-020. No production data work should begin until the trust boundary is known.

Acceptance criteria:

- Shared shell and tokens are reusable without duplicating the entire Deliveries page.
- Authentication and authorization enforcement points are identified or the affected work is explicitly blocked.
- No uncertain permission is implemented as allowed.
- Existing `/` preview behavior remains intact.
- Type-check/build checks pass.

### Stage 2 — Delivery Management vertical slice

**Status:** `In Progress` — preview only; production implementation `Blocked`

This is the first domain page because it is the operational source for completed deliveries and feeds later Fleet, Financials, Profitability, Reports, and Dashboard work.

Scope:

- Confirm canonical delivery fields, identifiers, relationships, statuses, completion rules, POD policy, corrections, and role permissions.
- Build the approved list/search/date-filter behavior.
- Add delivery detail and related truck/source-record links.
- Add approved create/edit/complete/void workflows only after schema and permission decisions.
- Add loading, empty, error, permission-denied, incomplete-record, and validation states.

Dependencies: Stage 1 trust boundary; D-002, D-003, D-011, and D-012.

Acceptance criteria: approved status transitions, traceable delivery relationships, honest missing-data states, server-side validation/authorization, and evidence-backed tests.

Reuse: keep the current `/` preview layout and shared styling; do not replace it with fabricated production behavior.

### Stage 3 — Fleet Management and Truck Profiles

**Status:** `Planned`

Fleet follows Delivery Management because truck profiles must connect to delivery history and preserve historical relationships.

Scope: fleet list/search/filter, truck detail, approved identifiers and attributes, historical delivery links, and approved active/retired behavior.

Dependencies: Stage 1; Stage 2 delivery-to-truck relationship; D-004 and role decisions.

Acceptance criteria: stable unique identifiers, searchable records, historical readability, approved inactive/retired behavior, and server-side permissions.

### Stage 4 — Delivery Financials and Transactions

**Status:** `Planned` / `Blocked`

Financials follow the operational records they reference and must be defined before any profitability or Dashboard metrics.

Scope: delivery-linked revenue/cost entries, company-level expenses, transaction list/detail, source relationships, validation, correction/void/reversal history, and reconciliation.

Dependencies: Stages 1–3; D-005 through D-009, D-011, and D-016.

Blocking decisions: approved categories, source documents, additional-hour/drop rules, currency precision/rounding, duplicate-cost prevention, and correction policy.

### Stage 5 — HR and Compensation Summaries

**Status:** `Planned` / `Blocked`

HR follows the core operational and financial record boundaries because compensation may feed approved analysis but contains sensitive personal data.

Scope: approved compensation summaries only, period filters, authorized HR views/editing, and permitted links into analysis.

Dependencies: Stage 1 authorization; approved HR fields/rates/periods and D-010; explicit boundary against full payroll.

Acceptance criteria: no invented compensation logic, protected personal data, correct periods, server-side permissions, and reconciliation evidence.

### Stage 6 — Profitability Analysis

**Status:** `Planned` / `Blocked`

Profitability must follow Delivery, Fleet, Financials, and any approved Compensation inputs so the traceability chain is real:

`Company result → truck → completed delivery → source financial records`.

Dependencies: Stages 2–5; approved formulas, status filters, date boundaries, currency/rounding, missing-data treatment, and D-005, D-009, D-016.

Acceptance criteria: every metric has an approved definition, source links, no duplicate costs, no unapproved overhead allocation, visible period/filter context, and known-result tests.

### Stage 7 — Global Search and Record Retrieval

**Status:** `Planned` / `Blocked`

Search follows the records and permission model it must query. It should reuse the shared filter/search patterns rather than inventing a separate interaction model.

Dependencies: implemented record types from Stages 2–6; Stage 1 authorization; approved searchable fields and sensitive-field exclusions.

Acceptance criteria: permission-safe results, defined matching behavior, visible/clearable filters, pagination, and no leakage of unauthorized records.

### Stage 8 — Reports, Exports, and Print

**Status:** `Planned` / `Blocked`

Reports follow approved data definitions and profitability formulas so screen totals and exports can reconcile.

Dependencies: Stages 2–7; D-014, approved audiences, formats, export limits, and permission rules.

Acceptance criteria: approved report catalog, filter/date context, reconciled totals, server-side export authorization, safe sensitive-field handling, and large/empty-result behavior.

### Stage 9 — User Management, Administration, and Settings

**Status:** `Planned` / `Blocked`

The authorization foundation must exist in Stage 1, but the user-facing administration screens can follow the core modules once their operational permissions are known.

Dependencies: authentication provider, user schema, approved role matrix, account lifecycle, session policy, audit requirements, and D-012, D-013, D-017, D-018.

Acceptance criteria: no self-escalation, server-side enforcement, high-impact confirmations, audit behavior, and protected sensitive settings.

### Stage 10 — Dashboard

**Status:** `Planned` / intentionally deferred

Dashboard is last among canonical screens because its metrics must be derived from completed and verified modules, not placeholder values.

Dependencies: approved outputs from Delivery, Fleet, Financials, HR where applicable, Profitability, Reports, and permissions; D-015 and default-period decisions.

Acceptance criteria: approved role-specific questions, source-linked metrics, visible date range, honest incomplete-data warnings, permission-safe drill-downs, and reconciliation with reports.

The current `/dashboard` route redirects to `/` until this stage is approved and its sources exist.

### Stage 11 — Cross-module integration and data integrity

**Status:** `Planned`

Verify delivery-to-truck-to-financial-to-profitability traceability, duplicate-cost prevention, corrections/history, date boundaries, permission scoping, and reconciled totals.

### Stage 12 — Full audit, responsive verification, and final handoff

**Status:** `Planned`

Audit every module against its specification, test loading/empty/error/permission states, verify desktop/tablet/mobile behavior, run available checks, update all documentation, and record unresolved blockers. Do not mark untested requirements as passed.

## 4. Shared components required before broad module work

The following should be extracted or standardized only as they are needed:

- Application shell and navigation.
- Page header and toolbar with search/date context.
- Resizable/collapsible sidebar and profile footer.
- Buttons and icon buttons with disabled/focus states.
- Cards and section containers using the current semantic tokens.
- Search fields, filters, and clearable filter state.
- Tables with horizontal overflow, sorting/pagination patterns, and row actions.
- Status indicators that pair color with readable text or icons.
- Loading, empty, error, permission-denied, and incomplete-data states.
- Confirmations/dialogs for high-impact changes.
- Permission-aware action areas backed by server-side enforcement.

Do not create database-specific abstractions or permission helpers until the actual provider and trust boundary are approved.

## 5. Unresolved decisions and blockers

The following remain open in `docs/12-decisions-and-open-questions.md` and block production modules where applicable:

- Canonical delivery/truck fields, identifiers, statuses, completion, and POD policy.
- Revenue/cost categories, additional-time/drop rules, company expenses, overhead allocation, currency, timezone, rounding, and correction history.
- Compensation fields, rates, periods, reconciliation, and visibility.
- Final role/permission matrix, Corporate Secretary permissions, account lifecycle, sessions, and audit retention.
- Report catalog, audiences, formats, export limits, and sensitive-field masking.
- Dashboard metrics, default period, refresh behavior, and incomplete-data treatment.
- Deployment and release workflow.

No financial formula, compensation rate, permission, status transition, or production metric should be invented to unblock a screen.

## 6. Verification strategy

For every approved stage:

1. Inspect the relevant module specification and live dependencies.
2. Define acceptance criteria and changed files before editing.
3. Run the available type-check/build commands; no lint/test command currently exists.
4. Verify affected routes and states through browser/manual checks where available.
5. Test keyboard/focus, responsive layout, overflow, filters, empty/error/permission states, and data boundaries relevant to the stage.
6. Record actual commands, results, limitations, and screenshots/evidence where available.
7. Update `docs/13-progress-and-handoff.md` and this roadmap.
8. Stop for review before the next approved stage.

Current verified commands:

- `cmd /c npx tsc --noEmit` — passes after generated route types are current.
- `cmd /c npm run build` — passes for `/`, `/_not-found`, and the temporary `/dashboard` redirect.
- No lint or test script is configured.

## 7. Approval gate

Recommended next step: approve this roadmap and approve Stage 1 foundation audit, or revise the order/scope. No further page implementation should begin until that decision is made.
