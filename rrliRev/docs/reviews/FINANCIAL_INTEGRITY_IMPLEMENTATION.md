# Financial Integrity Implementation

Date: 2026-11-02

## Outcome

RouteX now models delivery expenses as explicit financial facts instead of treating missing or malformed values as zero. The implementation is additive and keeps historical deliveries financially incomplete until an operator reviews them.

## Implemented

- Added `confirmed`, `not_applicable`, and `unknown` resolution states for every supported trip expense and store entry fee.
- Added delivery financial states: `incomplete` and `finalized`.
- Kept trip revenue at delivery level while aggregating entry fees from the delivery's store drop-offs.
- Made total expenses, net income, and profit margin nullable when financial input is unresolved.
- Defined zero-revenue profit margin as `NULL`/`N/A`; negative net income and margins remain visible.
- Removed repository parsing that silently converted malformed financial database values to zero. Affected records retain integrity issue details and are excluded from confirmed profitability summaries.
- Added atomic PostgreSQL functions for creation, financial finalization, audited correction, and POD updates.
- Added expected-version checks and `409 VERSION_CONFLICT` API responses with `preserveInput: true`.
- Added idempotency records and transaction-scoped advisory locking so concurrent duplicate mutation keys cannot execute twice.
- Added correction reasons, previous/updated values, actor, timestamp, and version metadata to delivery activity history.
- Added a date-aware, RLS-respecting PostgreSQL profitability summary used by the dashboard. The dashboard no longer downloads every delivery page to calculate financial KPIs and truck rankings.
- Updated delivery creation to require an explicit state for each expense. Unknown values can be saved but cannot be financially finalized.
- Updated shared currency and percentage formatting to display invalid, unresolved, and zero-revenue margins as `N/A`.
- Added TypeScript unit coverage and PostgreSQL parity assertions.
- Added mandatory CI jobs for type checking, tests, production build, Supabase migration reset, and PostgreSQL parity checks.

## Migration safety

Migration: `supabase/migrations/20261102000000_financial_integrity.sql`

- The migration is additive except for rebuilding generated financial columns with state-aware expressions.
- Existing expense amounts are preserved.
- Existing rows receive `unknown` expense states and remain `incomplete`; historical zeroes are not assumed to be confirmed.
- No production migration was executed.
- A backup and staging `supabase db reset`/migration rehearsal are required before production use.

## Validation performed

- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — passed, 22 tests.
- `npm.cmd run build` — passed with Next.js 16.4.2; all routes compiled and static generation completed.
- PostgreSQL parity test file was added at `supabase/tests/financial_integrity_parity.sql` but was not run locally because this workspace has no configured disposable Supabase stack. CI starts a disposable Supabase environment, resets all migrations, and runs the parity assertions.

## Important remaining work

- Apply and verify the migration in a disposable/staging Supabase project before any production migration.
- Add a polished operator UI for correction review. Delivery creation captures explicit states and the delivery drawer can finalize a fully resolved record, but correction editing should be exposed as a dedicated form rather than a generic prompt or implicit edit.
- Extend server-side aggregate consumption to every report and truck-profile summary. The dashboard is migrated; some detailed pages still aggregate their currently loaded records in the browser.
- Add full API integration tests for authorization, stale versions, transaction rollback, and concurrent duplicate submissions against the disposable Supabase instance. SQL parity is mandatory in CI, but HTTP-level integration coverage remains to be added.
- Confirm the approved permission boundary for financial correction if it must be narrower than the current operations-write permission.

## Review checklist

- [ ] Review the three-state expense controls on `/deliveries/new`.
- [ ] Confirm historical deliveries remain incomplete after staging migration.
- [ ] Verify finalized totals against known delivery/drop-off examples.
- [ ] Verify zero-revenue margin is shown as `N/A` and losses stay negative.
- [ ] Submit the same idempotency key twice and confirm one result.
- [ ] Submit an old expected version and confirm a conflict without data loss.
- [ ] Review activity history for correction reason and before/after values.
- [ ] Approve the finalization/correction UI before production rollout.
