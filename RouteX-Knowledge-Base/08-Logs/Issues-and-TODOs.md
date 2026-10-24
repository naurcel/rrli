# Issues and TODOs

## Open work at a glance

- **BLOCKING:** 5
- **OPEN:** 15
- **VERIFY:** 4
- **Resolved-direction / derivative verification:** 1 (KB-017)
- **Total tracked items:** 25

Counts reflect the existing issue labels in this file; KB-017 is a resolved direction with derivative verification still noted, not a new open blocking item. Recount these labels whenever an item is added, updated, or resolved.

**Rule:** Items listed here must remain unresolved until a responsible person supplies an explicit decision or evidence. Do not silently infer answers. Status labels: `BLOCKING` means dependent implementation should not be finalized; `OPEN` means decision/configuration/test remains necessary; `VERIFY` means source or actual implementation needs checking.

## Financial business rules

### KB-001: Variable additional-hour charge
- **Status:** BLOCKING
- **Known:** Rate is variable. The previously mentioned ₱500/hour was illustrative only and must not be hard-coded as a universal amount.
- **Need:** Approved rate source, effective dates, trigger, included time, rounding/proration, caps if any, and revenue/cost classification.
- **Owner:** RRLI business approver TBD.

### KB-002: Additional-drop charge
- **Status:** BLOCKING
- **Known:** Additional-drop handling is discussed; no universal fixed rule is approved in the current knowledge base.
- **Need:** Included drop count, charge trigger, variable/fixed rate source, rounding, and accounting classification.

### KB-003: Profitability formulas and expense attribution
- **Status:** BLOCKING
- **Known:** Delivery, truck, and company profitability must be distinct; do not double-count expenses; no automatic overhead allocation without approval.
- **Need:** Approved formulas and worked examples for each level, company operating expenses, compensation summaries, owned/subcontracted truck cases, voided entries, and expense classifications.

### KB-004: Expense categories and source-entry semantics
- **Status:** OPEN
- **Known:** Source materials mention categories such as Fuel, Labor, Toll, Other, Permits, Entry Fees, Overtime, Demurrage, and Additional Drops; this is not a final approved category list, and labels may refer to different financial meanings.
- **Need:** Final category taxonomy, field definitions, required/optional rules, and whether each category is a revenue charge, cost, or either depending on context.

## Access control

### KB-005: Corporate Secretary permissions
- **Status:** BLOCKING for role-specific implementation
- **Known:** Role exists; exact module/field permissions are not defined.
- **Need:** Approved view/create/edit/void/export/POD permissions and data scope.

### KB-006: Final role/field-level access matrix
- **Status:** OPEN
- **Known:** Roles are Admin, President, Corporate Secretary, Operations, Finance, HR. Operations and Finance can edit delivery financial entries. Admin does not automatically get financial edit rights.
- **Need:** Final per-module and per-field permissions, especially POD, compensation, audit logs, reports/exports, dashboard metrics, and correction/void actions. Validate server-side.

## Data model and lifecycle

### KB-007: Final database schema and ERD
- **Status:** BLOCKING before schema is treated as final
- **Need:** Approved entities/fields, relationships/cardinality, identifiers, unique constraints, monetary precision/currency, crew assignment model, compensation periods, POD metadata, audit model, and migration approach.

### KB-008: Correction/void/reversal workflow
- **Status:** OPEN
- **Known:** Preserve history; do not permanently delete relevant financial/operational records. Deactivate trucks/employees/users while preserving historical references. Voided entries stay visible and are excluded from active totals according to approved rules.
- **Need:** Entity-by-entity correction process, reason requirements, approval workflow if any, immutable fields, before/after audit representation, and treatment in each report.

### KB-009: Retention and backup/recovery
- **Status:** OPEN
- **Known:** Data retention and backup are required in principle; specific retention period and backup schedule were TBD in source SRS.
- **Need:** Retention periods, backup frequency, recovery point/time objectives, storage retention, restore test procedure, owner, and evidence of successful restore.

## POD, search, and reports

### KB-010: POD validation and missing-POD behavior
- **Status:** OPEN
- **Need:** Accepted file types, maximum file size, whether POD is mandatory and under which conditions, missing-POD trigger, resolution behavior, replacement history, and permitted roles.

### KB-011: Report/export specifications
- **Status:** OPEN
- **Need:** Final report list, columns, formats, date boundaries/time zone, grouping, void treatment, role permissions, and export limits.

## Technical implementation and operations

### KB-012: Auth.js + Supabase integration spike
- **Status:** VERIFY
- **Need:** Validate session/auth flow, server-side authorization, database access pattern, and secure file access with the chosen versions.

### KB-013: Hosting account ownership and billing
- **Status:** OPEN
- **Known:** Vercel and Supabase are proposed/current stack choices.
- **Need:** Account owner, payer, admin contacts, project ownership, access handover, and environment separation.

### KB-014: Performance targets and browser support
- **Status:** OPEN
- **Need:** Quantitative response-time/load targets, supported browser versions, concurrent user assumptions, and testing method.

### KB-015: Audit scope and access
- **Status:** OPEN
- **Need:** Exact events to log, audit access permissions, retention, tamper-resistance expectations, and whether users can view their own/relevant events.

## Design and workflow conflicts

### KB-016: Legacy roles and workflow statuses
- **Status:** VERIFY
- **Known:** Older drafts/prototype materials use other role names and statuses such as Pending/In Transit. Current role set and completed-delivery-only workflow supersede those as current direction.
- **Need:** Identify every affected legacy spec/screen and mark/update non-canonical derivative docs; never alter canonical originals.

### KB-017: Delivery timing fields
- **Status:** RESOLVED direction; verify derivatives
- **Known:** Call Time, ETA/arrival, Start Loading, and End Loading are not required fields in the current workflow and must not drive automated charges.
- **Need:** Remove from current forms/validation/calculation logic if present; do not change canonical source copies.

### KB-018: Design source reconciliation
- **Status:** OPEN
- **Known:** Working packages share a table/search/whitespace-oriented direction but differ in some navigation and screen details.
- **Need:** Confirm final information architecture, exact design tokens, responsive scope, and which prototype version is current for visual reference.

## Contract and project management

- **Update Thursday, October 22, 2026 — 13:53 UTC:** The frontend loop manual now documents the current 11-entry screen inventory and marks the final information architecture/mockup mapping as unresolved. See [Frontend Loop Engineering](../04-Development/Frontend-Loop-Engineering.md) and [session log](Agent-Sessions/2026-10-22-Frontend-Loop-Engineering-Setup.md).

### KB-019: Letter of Agreement support duration
- **Status:** OPEN (contract text alignment)
- **Known:** User clarified intended support period is one month from final acceptance/turnover. Older LOA wording conflicts (six months in one section and garbled/contradictory wording in another).
- **Need:** Align the signed/authoritative agreement text and remove ambiguity before treating it as contractually settled.

### KB-020: Timeline and current progress
- **Status:** VERIFY
- **Known:** Stated project window is Aug 10-Dec 4, 2026; active development was stated to begin Oct 19; deadline remains Dec 4 unless written amendment.
- **Need:** Confirm actual completed work, current schedule, client feedback/UAT availability, and any written amendments. Do not claim a task is complete without evidence.

### KB-021: Team development ownership
- **Status:** OPEN
- **Known:** Project documents name Project Manager, System Analyst, and Tester/Developer or QA roles, but development ownership/availability needs confirmation.
- **Need:** Confirm assigned developer(s), responsibility split, availability, and final acceptance authority.

### KB-022: Hosting/data handover and IP details
- **Status:** OPEN
- **Known:** Agreement materials distinguish deployed system, data export, user manual, technical documentation, and provider-retained core source code.
- **Need:** Confirm hosting ownership/access, exact export/turnover contents, and operational support obligations with the agreement owner.

## Quality and acceptance

### KB-023: Acceptance criteria and UAT sign-off
- **Status:** OPEN
- **Need:** Approved test cases, severity thresholds, named UAT participants, sign-off authority, and defect acceptance policy.

### KB-024: Implementation status versus prototype
- **Status:** VERIFY
- **Known:** HTML prototype uses sample/mock data and does not prove production persistence, secure authorization, or every feature.
- **Need:** Verify each feature in the actual repository/deployed app and link to code/test evidence before marking implemented.

- **Update Thursday, October 22, 2026 — 13:53 UTC:** The frontend loop manual now documents the current 11-entry screen inventory and marks the final information architecture/mockup mapping as unresolved. See [Frontend Loop Engineering](../04-Development/Frontend-Loop-Engineering.md) and [session log](Agent-Sessions/2026-10-22-Frontend-Loop-Engineering-Setup.md).
- **Update Thursday, October 22, 2026 — 13:53 UTC:** The available workspace did not include the live application repository or branch history; no production implementation claims or Build/Audit ticks were made.

### KB-025: Canonical source coverage
- **Status:** OPEN
- **Need:** During ongoing project work, add any missing source files to the canonical archive and update [Source Index](../09-References/Source-Index.md). Canonical copies must remain byte-for-byte unmodified.
