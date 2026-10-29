# Functional Preview Filters and Fleet Disclosure

**Date:** 2026-10-28  
**Scope:** Frontend preview interactions only

## Changes

- Replaced the global date-control portal with direct rendering inside the shared top bar, preventing stale placement and calendar clipping.
- Added shared root date-range state that survives client route navigation.
- Applied the selected range to dated preview records on Overview, Deliveries, and Transactions.
- Made Fleet Owned Trucks Hide/Show functional with animated height/opacity, updated text and chevron state, and `aria-expanded`/`aria-controls`.
- Added owned-truck type filtering.
- Added functional subcontractor search and status filtering.
- Added a Delivery driver filter behind More filters; existing search and POD filters remain functional.
- Added functional Transaction search and status filtering.
- Added filtered empty states and live result counts.

## Intentional limits

- Fleet profitability figures and Dashboard summary cards remain preview totals; they are not recalculated because approved financial aggregation rules do not exist.
- Date calculations still use the browser's local timezone. Business timezone and period-boundary policy remain unresolved.
- Filters operate only on local preview records and do not update URLs or query a backend.

## Validation

- `npm test`: passed, 17/17.
- `npm run typecheck`: passed.
- `npm run build`: passed after moving current-time reads into client effects for Next.js 16 prerender compatibility.
- `git diff --check`: passed with existing line-ending warnings only.
- Live `/fleet`, `/`, `/transactions`, and `/dashboard` checks: HTTP 200, direct date control appears before top-bar actions, and interactive control markup is present.

## Manual review checklist

- Open the date picker near the left breadcrumb and confirm all seven columns are visible.
- Collapse and reopen Owned Trucks; confirm the cards animate and the text changes between Hide and Show.
- Filter owned trucks by type.
- Search subcontracted trucks and reveal/filter by status.
- On Deliveries, combine search, POD, driver, and date filters.
- On Transactions, combine search, status, and date filters.
