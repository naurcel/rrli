# Module 3: Delivery Financials and Transactions

## Purpose
Record and retrieve financial values associated with individual deliveries without duplicating costs or losing source traceability.

## Scope
- Delivery-linked revenue and cost entries, according to approved schema.
- Transaction list and detail views.
- Links to the delivery and source documents/records.
- Validation and correction workflows.
- Distinction between delivery-linked costs and general company expenses.

## Rules
- Never guess financial categories or formulas.
- Never deduct one cost twice.
- Do not hard-code the example ₱500/hour additional-time rate as policy.
- Preserve history according to the approved correction/void/reversal approach.
- Use server-side authorization and validation.
- Confirm decimal-safe storage and calculation behavior.

## Implementation sequence
1. Inspect existing financial schema and source records.
2. Obtain the approved category list, formulas, currency, and rounding rules.
3. Confirm whether entries can be edited, voided, or reversed and how history is retained.
4. Implement transaction listing/search/filtering.
5. Implement create/edit/detail workflows for approved roles.
6. Validate values, dates, category, delivery relation, and required evidence.
7. Ensure totals are reconciled from the correct source records.
8. Add audit/history visibility where required.
9. Test duplicates, missing values, boundaries, and permissions.

## Acceptance checklist
- [ ] Each transaction has a clear source and relationship.
- [ ] Delivery costs remain separate from general company expenses.
- [ ] Duplicate deductions are prevented.
- [ ] Rates and formulas come from approved rules.
- [ ] Financial history follows the correction policy.
- [ ] Currency and rounding are consistent.
- [ ] Server-side permissions and validation are present.
- [ ] Tests include known expected results.
- [ ] Reconciliation evidence is recorded.

## Decisions needed
- Revenue/cost categories and definitions.
- Additional-hour and additional-drop rules.
- Source document requirements.
- Correction, void, reversal, and approval policy.
- Currency precision and rounding.
- Role-by-role edit permissions.
