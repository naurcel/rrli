# Module 4: HR and Compensation Summaries

## Purpose
Maintain approved compensation summaries used by the business without silently expanding RouteX into a full payroll product.

## Scope
- Compensation summary records and relevant staff/driver/helper references, as approved.
- Search and date/period filters.
- Detail and edit views for authorized HR users.
- Links to approved financial analysis where relevant and permitted.

## Explicit boundaries
Unless separately approved, do not implement:
- Full payroll processing.
- Attendance/timekeeping.
- Payslip generation.
- Automatic bank payments.
- Tax or statutory contribution filing.
- Compensation rules inferred from a few sample records.

## Rules
Rates, allowances, advances, pay periods, deductions, reconciliation, and eligibility rules are unresolved until found in an approved source. Do not guess them. Protect personal compensation data and avoid exposing it in general reports.

## Implementation sequence
1. Inspect existing HR-related tables and approved documents.
2. Confirm the meaning of each compensation field and pay period.
3. Confirm how drivers/helpers/staff relate to trucks and deliveries.
4. Confirm the permitted calculation and reconciliation rules.
5. Implement list/search/detail and authorized edit forms.
6. Enforce server-side role permissions and field validation.
7. Limit visibility in dashboards, search, and exports.
8. Test period boundaries, missing values, access controls, and reconciliation.

## Acceptance checklist
- [ ] Only approved fields and calculations are present.
- [ ] No full-payroll functionality has been added without approval.
- [ ] Personal data is protected by server-side authorization.
- [ ] Period and date behavior is correct.
- [ ] Compensation totals use approved rules.
- [ ] Exports respect field-level and role permissions where applicable.
- [ ] Tests and evidence are recorded.

## Decisions needed
- Compensation fields and definitions.
- Period boundaries and rate sources.
- Treatment of advances/allowances/deductions.
- Reconciliation and correction policy.
- Role access to compensation records and exports.
