# Test Strategy and Criteria

## Required test coverage
- Required delivery fields and valid date/amount inputs
- Prevent direct editing of calculated profitability fields
- Variable additional-hour and additional-drop rules after approval, including boundary cases
- Expense not double-counted in company totals
- No automatic overhead allocation without approval
- Correction/void preserves history and recalculates active totals correctly
- Deactivated truck/employee remains visible through historical delivery links
- Disabled user and role changes enforce correct access
- Admin cannot edit financial entries by default
- Corporate Secretary access matches the explicitly approved matrix
- POD is private; unauthorized users cannot access files through direct URLs or endpoints
- Reports and exports reconcile with source records and apply permissions
- Backup restore recreates data and required file references within agreed targets

## Test data
Use synthetic test data or client-approved masked data. Do not put real personal or financial data in source control or agent prompts unnecessarily.

## Exit criteria
All critical financial and authorization tests pass; no unresolved blocker is silently waived; client UAT outcomes and acceptance are recorded; backup/restore and deployment smoke tests pass. Quantitative thresholds and sign-off authority must be agreed.
