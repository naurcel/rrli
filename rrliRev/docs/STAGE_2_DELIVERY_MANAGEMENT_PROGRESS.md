# Stage 2 Delivery Management Progress

Last verified: 2026-11-02

This document records the implemented state of the revised RouteX application. It is a progress report, not a claim that the full Stage 2 scope is complete.

## Completed in the first Stage 2 increment

### Database foundation

- Added normalized employees, delivery-document requirements, delivery documents, delivery activity, and staged Excel-import row tables.
- Extended completed delivery records with driver/helper relationships, a version field, delivery status, and a generated profit-margin value.
- Added query indexes for date, client, truck, POD state, delivery state, revenue, net income, profit margin, and waybill lookup.
- Added a security-invoker `delivery_ledger` view for the delivery list.
- Added a private `delivery-documents` storage bucket and authenticated RLS policies.
- Added atomic PostgreSQL functions for creating a delivery with one or more drop-offs and for updating a drop-off's POD/document state.
- Added delivery activity entries for delivery creation and POD-state changes.

Migration: [`20261101010000_stage2_delivery_management.sql`](../supabase/migrations/20261101010000_stage2_delivery_management.sql)

### Delivery list

- Replaced the in-memory delivery API with a Supabase-backed repository.
- Added server-side filtering by waybill, client, truck, delivery status, POD status, and delivery-date range.
- Added server-side sorting by delivery date, client, revenue, net income, and profit margin.
- Added server-side pagination with supported page sizes of 10, 25, 50, and 100.
- Added explicit loading, empty, database-not-configured, and query-failure states.
- Preserved server-side RBAC checks before delivery data is read or changed.

### Delivery creation and POD mutation foundation

- Delivery creation now calls the database function instead of writing to a process-local array.
- Creation validates the request, resolves an active client and active Fleet record, enforces unique waybills, inserts all drop-offs atomically, and records an activity event.
- POD updates now call the database function, update a specific delivery/drop-off, derive the current aggregate POD state, increment the record version, and record an activity event.
- Unconfigured Supabase environments return an explicit `503` response instead of pretending a write succeeded.

### Completed-delivery workflow integration

- Added `/deliveries/new` as a server-authorized completed-trip entry screen.
- The form selects active client and Fleet records, records the actual delivery date and unique waybill, supports multiple store drop-offs, and captures itemized trip expenses.
- A live financial review keeps revenue, store entry fees, total expenses, and net income distinct; the database remains authoritative for persisted totals.
- Newly recorded trips begin with store documents pending and continue into the POD document queue.
- Repaired the POD queue to consume the persisted delivery-list response and reconcile successful store-document updates.
- Dashboard, Truck Profitability, and Reports now consume the same authorized, date-filtered persisted delivery ledger instead of bundled sample records.

### Automated verification

- Query parsing and invalid-range/page-size cases are covered by tests.
- Existing domain, RBAC, route-policy, session, and environment tests remain green.
- `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build` pass as of the date above.

## Not yet complete

- Delivery edit/correction screens backed by the database API.
- Dedicated delivery detail page and editable multi-store drop-off workflow.
- Full POD upload, signed-download URL, verification, rejection, and client-specific document checklist UI.
- Excel upload, column mapping, row parsing, validation review, correction, and final commit workflow.
- Full filtered aggregate totals; list summary values currently describe the returned page rather than the entire result set.
- Server-side aggregate queries for totals beyond the current authorized delivery-page fetches.
- End-to-end tests against a migrated Supabase test project.
- Delivery completion lifecycle service, idempotency, stale-record protection, locking/correction flow, and transaction-failure tests.

## Decisions still required

The implementation deliberately does not invent these rules:

1. Delivery lifecycle statuses beyond the current completed-record workflow.
2. Exact Excel column names and how one trip with multiple stores appears in source spreadsheets.
3. Which supporting document types are mandatory for each client.
4. Whether entry fees are supplied per drop-off or only as a trip-level total in imported files.
5. Retention, replacement, and deletion rules for rejected or superseded POD files.
6. Authorized correction rules for completed and financially locked records.

## Applying the database work

Apply both migrations in order to the intended Supabase project:

1. `20261101000000_routex_revised_foundation.sql`
2. `20261101010000_stage2_delivery_management.sql`

The migration was reviewed and the application compiles, but it was not applied to an external Supabase project during this increment. Database behavior must be verified in a disposable test project before production use.
