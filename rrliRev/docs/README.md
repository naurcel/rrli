# RouteX Documentation Center & Master Index

> **Primary Working Codebase:** `rrliRev/`  
> **System Purpose:** Delivery Operations, Locations & Drop-offs, POD Documents, and Truck Profitability  
> **Client Organization:** Redeemed Route Logistics Inc. (RRLI)  
> **Last Verified & Audited:** November 2026  
> **Master Source of Truth:** [`CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md`](./CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md)

Welcome to the RouteX documentation center. All active system documentation, knowledge base references, design system tokens, technical specifications, and historical audits are centralized here inside `rrliRev/docs/`.

---

## Master Specification & Requirements Source of Truth

- [**Central Requirements & System Design Specification (`docs/CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md`)**](./CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md)  
  *The authoritative, single source of truth for all confirmed business rules, delivery structures, employee identification, fleet management, financial invariants, and the planned Supabase backend architecture.*

---

## Document Status & Taxonomy

Every document indicates its implementation and authority state:
- **`[Authoritative Source of Truth]`**: Primary canonical requirements and system design.
- **`[Frontend Implemented]`**: Actively functioning in the current frontend application.
- **`[Mock-Only]`**: Backed by local storage or deterministic fixtures (`small-mock-database.ts`).
- **`[Planned Backend]`**: Future PostgreSQL schema, RLS policies, or Supabase Storage integration.
- **`[Superseded]`**: Historical specification retained for context.

---

## 1. Central Knowledge Base (`docs/knowledge-base/`)

| Document | Status | Scope & Key Contents |
| :--- | :--- | :--- |
| [**01 — Project Overview**](./knowledge-base/01-project-overview.md) | `[Authoritative]` | Mission, scope boundaries, user personas, dual-mode architecture. |
| [**02 — System Architecture**](./knowledge-base/02-system-architecture.md) | `[Authoritative]` | Layered model, App Router flow, sequence diagrams, storage adapters. |
| [**03 — Technology Stack**](./knowledge-base/03-technology-stack.md) | `[Authoritative]` | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Node.js test runner. |
| [**04 — System Modules**](./knowledge-base/04-system-modules.md) | `[Authoritative]` | All 11 workspace modules: Dashboard, Deliveries, Details, Record, Fleet, Finance, PODs, Reports, Users. |
| [**05 — Database Documentation**](./knowledge-base/05-database-documentation.md) | `[Planned Backend]` | PostgreSQL relational schema: `deliveries`, `delivery_locations`, `delivery_expenses`, `employees`, `trucks`. |
| [**06 — Business Rules**](./knowledge-base/06-business-rules.md) | `[Authoritative]` | Delivery & location invariants, unique Employee IDs, crew quotas, owned vs. subcontracted expenses, unknown expense rules. |
| [**07 — User Roles & Permissions**](./knowledge-base/07-user-roles-and-permissions.md) | `[Authoritative]` | 6-role RBAC matrix, access levels, route protection, Backdating Requests authorization. |
| [**08 — Authentication & Security**](./knowledge-base/08-authentication-and-security.md) | `[Authoritative]` | HMAC-SHA256 session tokens, RFC 9106 Argon2id password hashing, recovery workflows. |
| [**09 — UI/UX Guidelines**](./knowledge-base/09-ui-ux-guidelines.md) | `[Authoritative]` | Readex Pro typography, color variables, dark theme tokens, single globals.css cascade. |
| [**10 — API & Server Logic**](./knowledge-base/10-api-and-server-logic.md) | `[Authoritative]` | Route Handlers catalog: Auth, Deliveries, Backdating Requests, Finance, Trucks, Users. |
| [**11 — File Management**](./knowledge-base/11-file-management.md) | `[Authoritative]` | Delivery-level and Location-level POD attachments, private storage pre-signed URLs, SVG previews. |
| [**12 — Reporting & Calculations**](./knowledge-base/12-reporting-and-calculations.md) | `[Authoritative]` | Daily Trip Report, customizable templates, profit margin formulas, export package suite. |
| [**13 — Testing & Quality Assurance**](./knowledge-base/13-testing-and-quality-assurance.md) | `[Authoritative]` | 346 automated tests across 18 suites, verification gates, regression safeguards. |
| [**14 — Deployment & Maintenance**](./knowledge-base/14-deployment-and-maintenance.md) | `[Authoritative]` | Environment variables, dual-mode deployment, documentation conventions. |

---

## 2. Design System & Frontend Specifications (`docs/design/`)

- [**Design System Index (`docs/design/README.md`)**](./design/README.md)
  1. [`DESIGN_PHILOSOPHY.md`](./design/DESIGN_PHILOSOPHY.md) — Visual identity, design restraint, and presentation principles.
  2. [`DESIGN_TOKENS.md`](./design/DESIGN_TOKENS.md) — Colors, light/dark theme variables, typography scales, spacing, radii, surfaces.
  3. [`LAYOUT_AND_SPACING.md`](./design/LAYOUT_AND_SPACING.md) — Collapsible sidebar, topbar, page padding, Grid templates, responsive breakpoints.
  4. [`COMPONENT_DESIGN.md`](./design/COMPONENT_DESIGN.md) — Reusable controls: `RoundedSelect`, `TablePagination`, filter dropdowns, timeline, modals.
  5. [`INTERACTION_AND_MOTION.md`](./design/INTERACTION_AND_MOTION.md) — Hover/focus/active states, transitions, keyframes.
  6. [`TYPOGRAPHY_AND_HIERARCHY.md`](./design/TYPOGRAPHY_AND_HIERARCHY.md) — Readex Pro type scale, heading styles, KPI numerals, currency formatting.
  7. [`UI_STATES_AND_FEEDBACK.md`](./design/UI_STATES_AND_FEEDBACK.md) — Semantic status pills, attention-needed alerts, validation banners, empty states.
  8. [`FRONTEND_CONVENTIONS.md`](./design/FRONTEND_CONVENTIONS.md) — Cascade architecture, browser preview reactivity, accessibility rules.

---

## 3. Historical Progress & Early Foundations (`docs/` & `docs/reviews/`)

- [`REVISED_SCOPE_AND_AUTH_FOUNDATION.md`](./REVISED_SCOPE_AND_AUTH_FOUNDATION.md) — `[Superseded in part]` Early architectural foundation note.
- [`SMALL_MOCK_DATABASE.md`](./SMALL_MOCK_DATABASE.md) — Specification for the verified in-memory/browser fixture database.
- [`STAGE_2_DELIVERY_MANAGEMENT_PROGRESS.md`](./STAGE_2_DELIVERY_MANAGEMENT_PROGRESS.md) — `[Historical]` Early Stage 2 progress report.
- [`STAGE_3_COMPLETED_DELIVERIES_PROGRESS.md`](./STAGE_3_COMPLETED_DELIVERIES_PROGRESS.md) — `[Historical]` Early Stage 3 progress report.
- [`ROUTEX_RBAC_AND_USE_CASE_DIAGRAM_REFERENCE_GUIDE.md`](./reviews/ROUTEX_RBAC_AND_USE_CASE_DIAGRAM_REFERENCE_GUIDE.md) — Detailed Use Case diagrams and actor references.
