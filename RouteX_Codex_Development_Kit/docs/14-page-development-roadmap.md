# RouteX Page Development Roadmap

**Reviewed:** 2026-10-25

**Source of truth:** live repository plus approved RouteX requirements. The roadmap is a proposal; statuses describe verified code, not approval to start a stage.

## Current verified state

### Stack

- Next.js 16.4.2 App Router, React/React DOM 19.3.0, TypeScript 5.x, Tailwind CSS 4.x, npm.
- Main styles/tokens live in `src/app/globals.css`; Readex Pro is loaded in `src/app/layout.tsx`.
- Supabase browser/server clients, Zod validation, and a server route-protection boundary are installed. Local preview mode remains available when Supabase environment values are absent; no production database schema or storage workflow is connected.
- No shadcn/ui or Lucide dependency is installed.
- `dev`, `build`, `start`, `typecheck`, and dependency-free `test` scripts exist. Type checking, 17 unit tests, the production build, and HTTP route smoke checks currently pass.

### Live routes

| Route | Current verified implementation | Status |
|---|---|---|
| `/` | Server redirect to `/dashboard` | Dashboard is the default application entry |
| `/dashboard` | Dashboard preview with local summary fixtures, recent delivery rows, attention items | Preview exists; approved metrics and source integration blocked |
| `/deliveries` | Delivery listing preview with local search, POD/driver/date filters, preview records, empty state, disabled create/export | Preview exists; production data/workflows blocked |
| `/fleet` | Owned truck cards and subcontracted truck table with preview figures | Preview exists; canonical fleet/data integration blocked |
| `/transactions` | Static financial record preview table | Preview exists; financial definitions/data integration blocked |
| `/reports` | Static report definition cards | Preview exists; report queries/exports blocked |
| `/administration` | Static member/role preview table | Preview exists; authentication and authorization blocked |
| `/settings` | Static settings preview cards | Preview exists; persistence and permissions blocked |
| `/login` | Email/password sign-in when Supabase is configured; local development preview sign-in otherwise; defaults to `/dashboard` | Session duration, recovery, invitation, and production environment configuration remain open |
| `/_not-found` | Next-generated fallback | Framework default |

Shared code includes the root layout, global styles, icon wrapper, shared date-range state/control, mouse-reactive shadow component, persistent sidebar state provider, tested sidebar width model, shared account control, operational sidebar, and operational top bar. Sidebar and top-bar duplication were resolved on 2026-10-28; the outer page-shell composition remains route-local. The date range filters dated local preview records on Overview, Deliveries, and Transactions but is not stored in the URL or connected to a server. No database schema or migration exists in this repository.

The top-level README’s Next 15/Supabase/Auth.js/shadcn/Vercel stack is not the live stack. Those technologies remain unselected until explicitly approved.

## Recommended stages

### Stage 0 — Inspection and project audit

**Status:** Complete for the 2026-10-25 audit.

**Evidence:** `docs/15-overnight-audit.md` and this roadmap.

Scope: verified Git state, routes, dependencies, styles, data/auth/test infrastructure, discrepancies, and baseline checks. Existing uncommitted user work was preserved. No application code changed in this audit.

Acceptance: audit evidence cites the live files and commands; limitations and owner decisions are explicit.

### Stage 1 — Architecture, data model, and trust-boundary decisions

**Status:** Blocked on owner decisions; next stage to approve.

**Relevant docs:** `docs/02-architecture-and-repository.md`, `docs/04-data-integrity-and-domain-rules.md`, `docs/05-access-control-and-security.md`, `docs/12-decisions-and-open-questions.md`, modules 1–4 and 8.

Scope: select database/provider, migrations, authentication/session policy, storage approach, server validation, authorization enforcement, audit needs, and canonical delivery/truck/user relationships. Resolve D-001 through D-004, D-011 through D-013, D-017, D-018, and D-020 to the extent needed for a first vertical slice.

Prerequisites: owner approval of architecture and permission boundaries. Do not connect real data before this stage.

Acceptance: decisions are recorded in the kit; a minimal trust-boundary diagram and data ownership map exist; uncertain permissions remain denied/undecided; no production schema change occurs without an approved migration plan.

### Stage 2 — Shared application foundation and visual primitives

**Status:** In progress; sidebar and top-bar structure are centralized and verified, while responsive/accessibility review and the remaining shell composition are incomplete.

**Expected files:** `src/app/layout.tsx`, `src/app/globals.css`, new shared shell/components only if approved.

Scope: the shared sidebar, top bar, and client-side date-range state are complete. Next, verify responsive and keyboard behavior before assessing whether the remaining page-shell composition and field/table/status/empty/error patterns should be extracted. Date filtering currently applies only to dated local preview records; server/timezone semantics remain unresolved. Preserve current RouteX visual direction. Address CSS duplication only with route-level regression checks.

Prerequisites: Stage 1 decisions; establish a minimal test/verification approach.

Acceptance: routes share one shell source, existing preview pages still render, keyboard/focus states work, mobile control visibility is intentional, and shared changes are checked on both table and form screens.

### Stage 3 — Delivery Management vertical slice

**Status:** Preview exists; production implementation blocked.

**Route/files:** `/`, `src/app/page.tsx`, approved delivery feature components/services, module `01-delivery-management.md`.

Scope: approved list/search/date filters, detail, create/edit/completion, truck/client/crew references, POD, validation, correction history, and loading/empty/error/permission states.

Prerequisites: Stages 1–2; D-002, D-003, client/crew decisions, and role permissions.

Acceptance: server-side validation/auth; approved statuses only; traceable record history; no fake production rows; tests cover filtering, boundaries, relationships, validation, and access.

### Stage 4 — Fleet Management and Truck Profiles

**Status:** Preview exists; production implementation blocked.
**Route/files:** `/fleet`, `src/app/fleet/page.tsx`, module `02-fleet-management.md`.

Scope: canonical truck records, search/filter, detail, historical deliveries, approved active/retired semantics, and appropriate loading/empty/error states.

Prerequisites: Stages 1–3, delivery-to-truck relationship, D-004, role scope.

Acceptance: stable identifiers, historical relationships preserved, validated writes and server authorization; profitability shown only after approved formulas exist.

### Stage 5 — Delivery Financials and Transactions

**Status:** Preview exists; blocked by financial rules.

**Route/files:** `/transactions`, `src/app/transactions/page.tsx`, module `03-delivery-financials.md`.

Scope: source-linked entries, delivery costs versus company expenses, approved categories, create/edit/correction/void/reversal process, reconciliation, and authorized listing/detail.

Prerequisites: Stages 1–4; D-005 through D-009, D-011, D-016.

Acceptance: decimal-safe calculations, no duplicate cost deductions, traceable history, approved currency/rounding/date basis, permission-safe data, and known-result tests.

### Stage 6 — HR and Compensation Summaries

**Status:** Not implemented; blocked by sensitive-data and compensation decisions.

**Route/files:** No route currently; module `04-hr-compensation.md`.

Scope: approved compensation summaries only, period behavior, protected access, and links to analysis where authorized. Full payroll remains out of scope unless separately approved.

Prerequisites: Stage 1 authorization; D-010, D-016, compensation source/period/rate decisions.

Acceptance: no guessed rates, deductions, or periods; server-side access; privacy-safe reports/search; reconciliation tests.

### Stage 7 — Profitability Analysis

**Status:** Preview values appear on Dashboard/Fleet; canonical implementation blocked.

**Routes/files:** no dedicated analysis route/service; module `05-profitability-analysis.md`.

Scope: approved company/truck/delivery measures with source drill-down and incomplete-data treatment.

Prerequisites: Stages 3–6 and approved definitions/formulas/categories/date/currency rules (D-005, D-008–D-010, D-015, D-016).

Acceptance: source-reconciled calculations, completed-delivery eligibility, duplicate-cost prevention, no unapproved overhead allocation, and deterministic tests.

### Stage 8 — Global Search and Record Retrieval

**Status:** Only local module search fields and an inert Dashboard field exist.

**Routes/files:** shared topbar and module pages; module `06-search-and-record-retrieval.md`.

Scope: approved entities/fields, permission-aware queries, date filters, result routing, pagination, and clear/no-results/error states.

Prerequisites: Stages 1 and 3–7; searchable fields and sensitive-field exclusions approved.

Acceptance: server-side permission parity with direct routes, defined matching behavior, visible/clearable filters, and leakage tests.

### Stage 9 — Reports, Exports, and Print

**Status:** Report-definition preview exists; generated reports/exports absent.

**Route/files:** `/reports`, `src/app/reports/page.tsx`, module `07-reports-and-exports.md`.

Scope: approved reports and audiences, query/filters, print/export formats, data quality messages, and server authorization.

Prerequisites: source modules and formulas; D-014, D-016; report audiences/field policy approved.

Acceptance: screen/export totals reconcile; filters and definitions are visible; server authorization and sensitive-field tests pass.

### Stage 10 — User Management, Administration, and Settings

**Status:** Preview pages exist; identity/access/persistence absent.

**Routes/files:** `/login`, `/administration`, `/settings`; module `08-admin-users-settings.md`.

Scope: approved sign-in/session lifecycle, user provisioning, role management, safe settings, account recovery, and audit events.

Prerequisites: Stage 1 provider, user schema, approved matrix, D-012, D-013, D-017, D-018.

Acceptance: server-side access enforcement, no self-escalation, explicit high-impact confirmation, audited sensitive changes, direct-request security tests.

### Stage 11 — Dashboard

**Status:** Preview exists; defer production metrics until source modules are reconciled.

**Route/files:** `/dashboard`, `src/app/dashboard/page.tsx`, module `09-dashboard.md`.

Scope: approved role-specific questions and small number of source-linked metrics, default period, data quality, and drill-downs.

Prerequisites: Stages 3–10 as relevant; D-015, D-016.

Acceptance: every metric has an approved formula and source; values reconcile to reports; date filter applies consistently; no preview fixture values presented as production.

### Stage 12 — Cross-module integration

**Status:** Not implemented.

**Scope:** validate Delivery → Truck → Financial source → Profitability/Report relationships, global date state, corrections/history, and access across modules.

Prerequisites: approved and implemented source modules.

Acceptance: relationship and date-boundary tests; no duplicate deductions; direct unauthorized paths blocked; dashboard/report totals reconcile.

### Stage 13 — Regression, accessibility, and final handoff

**Status:** Baseline only.

**Scope:** add/run the intentionally selected test tooling; audit every module; responsive, keyboard, error/empty/loading, privacy, financial, and access checks; align all docs.

Prerequisites: implemented modules and test infrastructure.

Acceptance: evidence-backed requirement matrix, actual command results, no unresolved critical decisions hidden, setup/operations handoff accurate. No production-ready claim without appropriate verification.

## Immediate recommendation

Approve Stage 1 decisions before any persistence/auth integration. If the owner wants a low-risk UI task first, the standalone date picker can receive focused interaction tests and controlled-state support, but applying it to business records must wait for date/timezone rules and real data sources.
