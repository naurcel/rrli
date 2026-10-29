# Top Bar Breadcrumb Removal

**Date:** 2026-10-29  
**Scope:** Shared application shell

## Changes

- Removed the shared `Operations / page` and `Manage / page` breadcrumb from the operational top bar.
- Removed the route-to-breadcrumb mapping and unused pathname dependency.
- Removed obsolete breadcrumb styling.
- Kept the global date filter at the left and workspace controls at the right.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 17/17.
- Source search confirmed no shared breadcrumb markup or styling remains.
