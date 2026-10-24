# Module 7: Reports, Export, and Print

## Purpose
Provide reliable, permission-safe reports that reconcile with the source data and clearly communicate filters and definitions.

## Rules
- Exported figures must use the same approved definitions as on-screen figures.
- Exports must enforce authorization, not bypass it.
- Do not add fabricated rows, values, or inferred categories.
- Include relevant date ranges, applied filters, generation date, and metric definitions where appropriate.
- Do not expose sensitive HR/financial fields to roles that cannot view them.
- Do not claim a report is an official accounting/tax document unless approved.

## Implementation sequence
1. Inventory required reports and their audiences.
2. Confirm metric definitions and source records.
3. Confirm allowed formats, export permissions, and size limits.
4. Build a report query/service that can be reused by the screen and export.
5. Implement filters and visible report context.
6. Add export/print behavior consistent with the actual stack.
7. Verify authorization on direct export requests.
8. Reconcile exported rows/totals with the screen.
9. Test date boundaries, large results, missing data, and sensitive fields.

## Acceptance checklist
- [ ] Each report has an approved definition and audience.
- [ ] Screen and export totals reconcile.
- [ ] Applied filters and date range are clear.
- [ ] Authorization applies to export routes/actions.
- [ ] Sensitive fields are restricted.
- [ ] Empty and large-result behavior is handled.
- [ ] Exported data is not fabricated.
- [ ] Tests and evidence are recorded.

## Decisions needed
- Required reports and formats.
- Report audiences and permissions.
- Field visibility and masking rules.
- Export limits and retention.
- Official-document disclaimers, if relevant.
