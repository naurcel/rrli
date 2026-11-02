# Testing Overview

Testing must prove that intended behavior is implemented, not merely visible in the prototype. Prioritize financial correctness, traceability, server-side authorization, historical preservation, POD privacy, search/report consistency, and backup/recovery.

Test categories:
- Unit tests for validation and financial calculation functions
- Integration tests for database persistence and lifecycle actions
- Authorization tests for roles, direct requests, exports, and file access
- UI workflow tests for completed delivery creation/edit, POD, search, and reports
- Reconciliation tests using client-approved worked examples
- UAT with authorized RRLI representatives
- Backup/restore and deployment smoke tests

Exact test framework, supported browsers, quantitative performance targets, and acceptance sign-off format remain TBD.

## Current repository evidence

The repository currently uses Node's built-in test runner, not Vitest or Jest.
The active `npm test` script covers local fixture selectors, authentication and
route-policy helpers, table/sidebar behavior, audit fixture validity, and
environment/error helpers. The latest verified frontend run passed 28 tests,
TypeScript checking, and the production build. No browser automation suite,
remote backend integration test, or UAT environment is configured.

This evidence validates local frontend behavior only. It does not satisfy the
future server authorization, financial reconciliation, storage, or UAT checks
listed above.
