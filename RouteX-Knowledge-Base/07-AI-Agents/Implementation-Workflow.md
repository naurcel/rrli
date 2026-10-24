# Implementation Workflow

For each feature:
1. Read relevant requirement, design screen, decision records, and unresolved issues.
2. Confirm there is no blocking TBD affecting behavior.
3. Define schema and server contract before UI wiring.
4. Implement validation, authorization, business logic, audit behavior, and data access server-side.
5. Add tests, including negative authorization cases and financial edge cases.
6. Connect UI to real actions; remove or label mock-only interactions.
7. Verify report/export/detail consistency and historical lifecycle behavior.
8. Update docs, tests, changelog, and traceability.
9. Report actual files changed and test outcomes.

If a blocker exists, implement only safe non-dependent work and record the blocker. Never substitute a guessed business rule to keep moving.
