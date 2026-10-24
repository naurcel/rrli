# Module 9: Dashboard

## Purpose
Offer a concise entry point for authorized users, emphasizing relevant operational status and truck/company profitability without turning the interface into an analytics wall.

## Design direction
- Use clear hierarchy and whitespace.
- Prefer a small number of approved, useful summaries.
- Keep search and date context easy to access.
- Use links to source records for investigation.
- Avoid generic KPI grids or decorative charts that do not answer a real user question.

## Rules
- Every displayed metric must have an approved definition.
- No fabricated/sample production values.
- Dashboard visibility follows role permissions.
- Date range and metric period must be clear.
- Incomplete data should be identified.
- Do not add charts solely for visual interest.

## Implementation sequence
1. Inventory approved dashboard questions by role.
2. Map each metric to approved formulas and source records.
3. Confirm default date range and refresh behavior.
4. Implement only the most useful approved summaries.
5. Add drill-down links and data-quality notices.
6. Test permission differences and date filters.
7. Compare dashboard figures with the corresponding reports.

## Acceptance checklist
- [ ] Dashboard answers approved user questions.
- [ ] Every metric has a source and definition.
- [ ] No sample or fabricated production figures appear.
- [ ] Permissions are enforced.
- [ ] Date range is visible and correct.
- [ ] Drill-downs are useful and permission-safe.
- [ ] Dashboard and reports reconcile.
- [ ] Tests and evidence are recorded.

## Decisions needed
- Role-specific dashboard content.
- Approved metrics and formulas.
- Default date range.
- Refresh expectations.
- Incomplete-data warning behavior.
