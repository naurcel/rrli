# Financial Reconciliation Tests

Build a client-approved test fixture set before implementing calculations. Each case should include source entries, expected delivery result, expected truck result, expected company result, and a written explanation of classification/aggregation.

Minimum scenarios:
1. One completed delivery with revenue and multiple expenses.
2. Multiple deliveries for one truck in the same period.
3. Company operating expense not linked to a delivery.
4. A delivery expense that appears in detail and in company report, ensuring it contributes once.
5. A voided financial entry, preserving history but excluded from active totals as approved.
6. Variable additional-hour fee at below/equal/above threshold boundaries after the rule is approved.
7. Additional drop count at included limit and beyond it after the rule is approved.
8. Owned versus subcontracted truck cases, if their treatment differs.
9. Compensation summary inclusion/exclusion according to the approved company-profitability formula.

Do not fabricate expected amounts for unresolved rules. Record the case as blocked pending RRLI approval.
