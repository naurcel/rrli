# Business Rules and Financial Calculations

## Confirmed principles
1. Evaluate profitability at delivery, truck, and company levels.
2. Delivery-level and company-level profitability must be presented distinctly.
3. An expense must not be counted more than once in company-level results.
4. Delivery-attributable expenses and company operating expenses must remain distinguishable.
5. Do not automatically allocate overhead without a client-approved rule.
6. Delivery margin is calculated from source revenue and expenses and is not directly editable as a source amount.
7. A previously discussed **₱500/hour** additional-hour amount was an example only, not a universal fixed rate.
8. Additional-hour charges are variable. Additional-drop fees are also not to be hard-coded without approved rules.

## Not yet safe to automate
The following details need explicit approval and test examples:
- Source of the variable hourly rate and effective-date handling
- Exact trigger for an additional-hour charge
- Whether partial hours are rounded up, rounded down, prorated, or handled another way
- Included drop count and how additional-drop charges are triggered
- Whether each charge is revenue, cost, or both in a particular business context
- Classification of labels such as fuel, labor, toll, permits, entry fees, overtime, demurrage, additional drops, and other
- Treatment of voided/reversed entries in each report
- Exact truck-level and company-level aggregation formula
- Treatment of compensation summaries in company profitability
- Handling of subcontracted trucks and any related cost attribution

## Implementation guardrail
Do not invent formulas or choose a default because it is convenient. Add worked examples approved by RRLI, including edge cases and reconciliation totals, before finalizing calculation code. All dashboard, report, and detail views must use the same calculation logic.

> Mirrors: `RouteX_LETTER OF AGREEMENT.docx.pdf`, Sections 1.4–1.5; `RouteX_Feature_Spec_and_Access_Control.md`, delivery financial-entry and profitability sections. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
