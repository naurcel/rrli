# Data Integrity and Domain Rules

## Purpose
RouteX profitability figures must be traceable, explainable, and resistant to double counting. Visual polish must never override financial correctness.

## Core relationships
The intended traceability chain is:
**Company result → truck → completed delivery → source financial records.**

Inspect the live schema and approved requirements to determine exact entities, keys, and relationships. Do not create duplicate source-of-truth records to make a screen easier to build.

## Completed deliveries
- Only completed deliveries should feed finalized delivery profitability unless an approved rule explicitly defines otherwise.
- Confirm the actual completion status and transition rules from approved requirements and current implementation.
- Do not treat pending, in-transit, cancelled, or otherwise incomplete deliveries as completed.
- A delivery should be traceable to the appropriate truck and source operational/financial records.
- Missing data should be shown as incomplete or unavailable, not silently replaced with zero or fabricated values.

## Costs and expense categories
Keep these concepts distinct:
1. **Delivery-linked costs**: costs directly associated with a particular delivery.
2. **Company-level expenses**: expenses not already recorded as delivery costs.
3. **Compensation summaries**: HR-maintained figures governed by approved compensation rules.

Do not deduct the same expense in more than one category. Do not automatically allocate overhead to trucks or deliveries unless the owner has approved the allocation method.

## Profitability formula policy
The exact revenue, cost, compensation, adjustment, rounding, and allocation rules must come from an approved specification or owner decision.

Do not assume a formula such as revenue minus a guessed list of costs is the final business rule. For every displayed profitability metric, document:
- Business name and meaning.
- Exact formula and included/excluded categories.
- Source records and relationships.
- Date range and status filters.
- Currency and rounding rules.
- Treatment of missing/incomplete data.
- Whether values are preliminary or finalized.
- Who approved the rule and when, if that record is available.

If any of these are unknown and materially affect the result, mark the metric blocked or label it provisional only if the owner explicitly allows provisional display.

## Additional-hour fees
The rate, trigger, rounding method, and additional-drop rules are unresolved unless found in an approved source. A ₱500/hour figure has previously been discussed only as an example, not a universal rate. Do not hard-code it as a company policy.
Confirm:
- Which time source is authoritative.
- When additional time starts and stops.
- Whether rounding is per minute, block, or another rule.
- Whether rates vary by contract, client, truck, or delivery type.
- How additional drops affect fees.
- Who can override a calculated value and how the override is recorded.

## Historical changes and corrections
- Do not silently delete or overwrite financial history.
- Follow an approved correction, void, reversal, or adjustment policy.
- Preserve who changed what and when where audit logging is required.
- If the current schema cannot preserve necessary history, report the gap before implementing destructive changes.
- A corrected value should remain traceable to its source and reason.

## Dates, currency, and totals
- Confirm the canonical timezone and business date rules.
- Confirm whether date filters are inclusive/exclusive at boundaries.
- Confirm the currency format and decimal/rounding behavior.
- Use decimal-safe storage and calculations appropriate to the verified database/runtime. Do not use floating-point math for money without a justified, reviewed design.
- Ensure report totals reconcile with the visible records and applied filters.
- Do not silently omit records that fail validation; explain why they are excluded.

## Data states
Handle at least the states relevant to each feature:
- Loading.
- Empty result.
- Validation error.
- Permission denied.
- Server/data error.
- Partial/incomplete record.
- Successful save.
- Conflict/stale record, if concurrent edits are possible.

## Required evidence
Before marking financial functionality done, record:
- Formula source/approval.
- Test examples with known expected results.
- Duplicate-cost prevention evidence.
- Date-filter boundary tests.
- Missing-data behavior.
- Correction/history behavior.
- Authorization evidence.
