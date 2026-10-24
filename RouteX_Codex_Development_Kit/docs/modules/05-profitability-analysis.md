# Module 5: Profitability Analysis

## Purpose
Help authorized users understand truck and company profitability and trace reported values to source records.

## User outcome
A user should be able to move from a company-level result to a truck, then to completed deliveries, then to the underlying source financial records.

## Rules
- Use approved formulas only.
- Include only eligible completed deliveries for finalized delivery-based figures unless an approved rule states otherwise.
- Keep delivery costs separate from company-level expenses.
- Do not allocate overhead without approval.
- Do not fabricate missing values or imply incomplete data is complete.
- Show the relevant period and filters.
- Make calculations explainable and traceable.

## Metric specification required before implementation
For every metric, record:
- Display name.
- Business definition.
- Exact formula.
- Included and excluded transaction categories.
- Delivery status filters.
- Date basis and boundary behavior.
- Currency and rounding.
- Missing/incomplete data behavior.
- Source record links.
- Approval status and owner.

If a critical formula is unresolved, build the surrounding structure only if useful, and mark the metric blocked. Do not display an invented calculation as a final result.

## Implementation sequence
1. Inventory approved metrics and formulas.
2. Map each formula to source tables/records.
3. Confirm eligible delivery states and date rules.
4. Implement query/aggregation logic with server-side authorization.
5. Add summary views and drill-down navigation.
6. Make the source records accessible from each result.
7. Display data quality warnings and incomplete-record states.
8. Test each formula against hand-calculated fixtures with known expected results.
9. Reconcile totals against the underlying filtered records.
10. Record formula and test evidence.

## Acceptance checklist
- [ ] Every metric has an approved definition.
- [ ] Filters and periods are visible.
- [ ] Drill-down leads to relevant source records.
- [ ] No duplicate costs are counted.
- [ ] No unapproved overhead allocation exists.
- [ ] Incomplete data is represented honestly.
- [ ] Server-side permissions apply to summaries and drill-downs.
- [ ] Tests cover expected totals, date boundaries, and excluded records.
- [ ] Reconciliation evidence is recorded.

## Decisions needed
- Company and truck metric definitions.
- Approved formulas and category mappings.
- Date basis and period boundaries.
- Treatment of incomplete deliveries/financial records.
- Whether provisional figures may be displayed.
