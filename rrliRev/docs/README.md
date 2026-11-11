# RouteX Documentation Center & Master Index

> **Primary Working Codebase:** `rrliRev/`  
> **System Purpose:** Delivery Operations, Multi-Store Drop-offs, POD Documents, and Truck Profitability  
> **Client Organization:** Redeemed Route Logistics Inc. (RRLI)  
> **Last Verified:** November 2026

Welcome to the RouteX documentation index. All active system documentation, knowledge base references, design system tokens, technical specifications, and historical audits are centralized here inside `rrliRev/docs/`.

---

## Document Authority & Status Taxonomy

Every document in this directory indicates its authority level:
- **`[Authoritative · Implemented]`**: Verified against the current working codebase with automated test coverage.
- **`[Authoritative · Agreed]`**: Formally approved specification or architectural standard.
- **`[Historical / Archived]`**: Implementation progress reports, regression audits, or legacy specifications preserved for context.

---

## 1. Central Knowledge Base (`docs/knowledge-base/`)

The primary source of truth for RouteX architecture, business logic, security, and operations:

| Document | Authority | Scope & Key Contents |
| :--- | :--- | :--- |
| [**01 — Project Overview**](./knowledge-base/01-project-overview.md) | `[Implemented]` | Mission, scope boundaries, user personas, problem statement, dual-mode storage overview. |
| [**02 — System Architecture**](./knowledge-base/02-system-architecture.md) | `[Implemented]` | Layered model, request flow, component responsibilities, data flow sequence diagrams. |
| [**03 — Technology Stack**](./knowledge-base/03-technology-stack.md) | `[Implemented]` | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Supabase, Node.js test runner. |
| [**04 — System Modules**](./knowledge-base/04-system-modules.md) | `[Implemented]` | In-depth breakdown of all 11 modules: Dashboard, Deliveries, Details, Record, Fleet, Finance, PODs, Reports, Users, Settings. |
| [**05 — Database Documentation**](./knowledge-base/05-database-documentation.md) | `[Implemented]` | PostgreSQL tables, foreign keys, constraints, RLS policies, browser preview mirrors. |
| [**06 — Business Rules**](./knowledge-base/06-business-rules.md) | `[Implemented]` | Financial invariants, unknown expense handling, incomplete state rules, 2024 boundary, 3-day window. |
| [**07 — User Roles & Permissions**](./knowledge-base/07-user-roles-and-permissions.md) | `[Implemented]` | Full 6-role RBAC matrix, access levels, server-side route guards, navigation visibility. |
| [**08 — Authentication & Security**](./knowledge-base/08-authentication-and-security.md) | `[Implemented]` | HMAC-SHA256 session tokens, RFC 9106 Argon2id password hashing, recovery workflows, first-login modal. |
| [**09 — UI/UX Guidelines**](./knowledge-base/09-ui-ux-guidelines.md) | `[Implemented]` | Readex Pro typography, color variables, dark theme, single globals.css, zero button shadows. |
| [**10 — API & Server Logic**](./knowledge-base/10-api-and-server-logic.md) | `[Implemented]` | Route Handlers catalog, request/response contracts, Zod schemas, audit logging store. |
| [**11 — File Management**](./knowledge-base/11-file-management.md) | `[Implemented]` | Stop-level POD attachments, signed URL storage policies, offline SVG receipts. |
| [**12 — Reporting & Calculations**](./knowledge-base/12-reporting-and-calculations.md) | `[Implemented]` | Daily Trip Report (single date), customizable templates, Excel CSV generator, margin formulas. |
| [**13 — Testing & Quality Assurance**](./knowledge-base/13-testing-and-quality-assurance.md) | `[Implemented]` | 16 test suites, 222+ tests, verification gates, test runner, regression safeguards. |
| [**14 — Deployment & Maintenance**](./knowledge-base/14-deployment-and-maintenance.md) | `[Implemented]` | Environment variables, Supabase migrations, deployment checklist, troubleshooting FAQ. |

---

## 2. Design System & Frontend Specifications (`docs/design/`)

Detailed visual design specifications for UI components, spacing, and styling:

- [**Design System Index (`docs/design/README.md`)**](./design/README.md)
  1. [`DESIGN_PHILOSOPHY.md`](./design/DESIGN_PHILOSOPHY.md) — Visual identity, design restraint, and presentation principles.
  2. [`DESIGN_TOKENS.md`](./design/DESIGN_TOKENS.md) — Colors, light/dark theme variables, typography scales, spacing, radii, surfaces.
  3. [`LAYOUT_AND_SPACING.md`](./design/LAYOUT_AND_SPACING.md) — Collapsible sidebar, topbar, page padding, Grid templates, responsive breakpoints.
  4. [`COMPONENT_DESIGN.md`](./design/COMPONENT_DESIGN.md) — Reusable controls: `RoundedSelect`, `TablePagination`, filter dropdowns, timeline, modals.
  5. [`INTERACTION_AND_MOTION.md`](./design/INTERACTION_AND_MOTION.md) — Hover/focus/active states, popover dismissal, transitions, keyframes.
  6. [`TYPOGRAPHY_AND_HIERARCHY.md`](./design/TYPOGRAPHY_AND_HIERARCHY.md) — Readex Pro type scale, heading styles, KPI numerals, currency formatting.
  7. [`UI_STATES_AND_FEEDBACK.md`](./design/UI_STATES_AND_FEEDBACK.md) — Semantic status pills, attention-needed alerts, validation banners, empty states.
  8. [`FRONTEND_CONVENTIONS.md`](./design/FRONTEND_CONVENTIONS.md) — Cascade architecture, browser preview reactivity, accessibility rules.

---

## 3. Technical Foundations & Database Specifications

Foundational architectural documents:

- [`REVISED_SCOPE_AND_AUTH_FOUNDATION.md`](./REVISED_SCOPE_AND_AUTH_FOUNDATION.md) — Architectural foundation for authentication, RBAC, and preview storage.
- [`SMALL_MOCK_DATABASE.md`](./SMALL_MOCK_DATABASE.md) — Specification and schema for the verified in-memory/browser fixture database.

---

## 4. Historical Implementation Reports & Audits (`docs/reviews/`)

Chronological records of past milestone implementations, security audits, and regression tests:

- [`DOCUMENTATION_AND_PROJECT_INDEPENDENCE_REPORT.md`](./reviews/DOCUMENTATION_AND_PROJECT_INDEPENDENCE_REPORT.md) — Project independence audit & knowledge base creation report.
- [`COMPANY_EXPENSES_IMPLEMENTATION.md`](./reviews/COMPANY_EXPENSES_IMPLEMENTATION.md) — Implementation report for company operating expenses and net profit.
- [`FINANCIAL_INTEGRITY_IMPLEMENTATION.md`](./reviews/FINANCIAL_INTEGRITY_IMPLEMENTATION.md) — Unknown expense handling and incomplete status rules.
- [`USERNAME_AND_PASSWORD_RECOVERY_IMPLEMENTATION.md`](./reviews/USERNAME_AND_PASSWORD_RECOVERY_IMPLEMENTATION.md) — Self-service recovery and Argon2id security questions.
- [`RECORD_VERIFICATION_REMOVAL.md`](./reviews/RECORD_VERIFICATION_REMOVAL.md) — Transition from manual verification to automatic financial resolution.
- [`MOCK_LOCATION_REPLACEMENT_REPORT.md`](./reviews/MOCK_LOCATION_REPLACEMENT_REPORT.md) — Replacement of static locations with realistic Philippine freight routes.
- [`CONSOLIDATED_CHANGE_REPORT.md`](./reviews/CONSOLIDATED_CHANGE_REPORT.md) — Historical changelog across early development milestones.
- [`OVERNIGHT_DEVELOPMENT_REPORT.md`](./reviews/OVERNIGHT_DEVELOPMENT_REPORT.md) — Development summary across major feature sets.

---

## 5. Developer & AI Assistant Quick Links

- **AI Agent Operating Manual:** [`../AGENTS.md`](../AGENTS.md)
- **Claude Quick Reference:** [`../CLAUDE.md`](../CLAUDE.md)
- **Main Developer Readme:** [`../README.md`](../README.md)
- **Database Migrations:** [`../supabase/migrations/`](../supabase/migrations/)
