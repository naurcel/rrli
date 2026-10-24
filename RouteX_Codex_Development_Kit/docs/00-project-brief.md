# RouteX Project Brief

## Product
**RouteX: Profitability Analysis System** is intended to help Redeemed Route Logistics Inc. (RRLI) understand company performance through completed deliveries, truck-level profitability, costs, and source financial records.

## Core outcome
A reviewer should be able to trace a reported company result back through:
**Company result → truck → completed delivery → source financial records.**

The system should make it easier to retrieve records and understand truck profitability. It should prioritize clarity, traceability, and trustworthy calculations over decorative analytics.

## Primary user groups
These are the working role names. Exact permissions must be approved and maintained in `05-access-control-and-security.md`.
- **Admin**: system administration; does not automatically receive every financial permission.
- **President**: reviews business and profitability information, subject to an approved access matrix.
- **Corporate Secretary**: role exists, but specific permissions require confirmation.
- **Operations**: manages operational delivery records and related workflow.
- **Finance**: manages approved financial entries and company expenses.
- **HR**: manages approved compensation summaries and related records.

## High-level operating model
- Operations records completed deliveries and supporting operational details.
- Finance records company expenses that are not already captured as delivery costs.
- HR maintains compensation summaries within the approved scope. This is not automatically a full payroll system.
- Leadership reviews truck and company earnings using approved calculations.

## Scope guardrails
### In scope, subject to approved requirements
- Delivery management for completed deliveries.
- Fleet management and truck profiles.
- Delivery-linked financial records and transactions.
- Non-delivery company expenses.
- HR compensation summaries, not full payroll.
- Profitability analysis based on approved formulas.
- Search and record retrieval.
- Reports, exports, and print views.
- User access management and system settings according to an approved permission matrix.
- Dashboard with approved metrics only.

### Out of scope unless explicitly approved
- Live GPS tracking.
- Dispatch and route optimization.
- Customer portal.
- Full accounting-system replacement.
- Tax/BIR filing.
- Full payroll, attendance, payslips, or automatic bank payments.
- Predictive maintenance.
- Inventory management.
- Third-party integrations not already approved.

## Product design direction
- Readex Pro typography, if compatible with the verified project stack and font-loading approach.
- Light theme as the baseline, with optional dark mode if approved/implemented.
- Collapsed or visually light sidebar.
- Search is a primary interaction.
- Date filters belong close to search or the page header.
- Emphasize information retrieval and truck profitability.
- Use generous whitespace, clear hierarchy, rounded corners, and restrained status accents.
- Avoid maps, marketing hero sections, futuristic control-center aesthetics, dense analytics walls, and generic SaaS KPI grids unless a requirement explicitly changes.

## Non-negotiable data principles
1. Only completed deliveries should feed finalized delivery profitability unless an approved requirement defines another state.
2. Delivery costs and company-level expenses must remain distinguishable.
3. Never deduct the same cost twice.
4. Do not invent overhead allocation.
5. Do not fabricate missing values for reports.
6. Preserve source records, corrections, and history.
7. Show missing or incomplete data honestly.

## Important uncertainty
This document describes the intended product. The live repository, approved specifications, actual database, and owner decisions must be inspected before implementation. When evidence conflicts, report it and ask for a decision.
