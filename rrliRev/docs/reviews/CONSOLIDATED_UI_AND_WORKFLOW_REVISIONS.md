# Consolidated UI and Workflow Revisions

Date: 2026-11-04

## Initial assessment

RouteX already had completed-delivery listing, centralized financial calculations, truck profitability, local and Supabase repositories, role-based route/API checks, truck creation, private POD endpoints, and browser-local demo persistence. The expanded delivery view was already visually enlarged, but its fixed layer was rendered inside a transformed route container, so it was offset from the viewport. The recording flow saved immediately without a final review. POD still exposed review, verification, rejection, and unverify actions. Dropdowns used mixed native and custom implementations, and the custom menu could be clipped by containing elements. Settings still exposed the undecided System Posture content. User Management did not expose an audit log.

## Changes implemented

- Delivery detail layers now portal to `document.body`, center against the viewport, retain a scrollable body and sticky header/footer structure, and no longer duplicate the top-right close action in the footer.
- Delivery detail copy now treats POD files as attached or missing and removes review/verification language. The record version and financial integrity section is presented as Activity and Record History.
- The recording form now requires an explicit temperature entry, separates Revenue from Expenses, uses the label Delivery Rate, limits trips to ten drop-offs, and presents drop-offs as a connected vertical timeline.
- Form submission now opens a complete review modal first. Users can return to editing, and the final mutation reuses one idempotency key to protect against accidental duplicate confirmation.
- POD and supporting file selectors are available during recording and their selected filenames appear in the preview.
- POD detail UI is now Upload/Replace -> View. Review notes, Reference, approve, reject, verify, and unverify controls were removed from the connected delivery overlay. Images and PDFs use inline viewers when a signed URL is available; additional documents are collapsed by default.
- Shared dropdown menus now render through a body portal, use an opaque surface, reposition on viewport/scroll changes, open upward when necessary, and support ownership group headings.
- Delivery truck selectors group Owned Trucks and Subcontracted Trucks using persisted ownership metadata.
- Add Truck now includes image selection, preview, replacement before save, and association with the created plate in browser-local mode. Truck type and ownership use the shared dropdown.
- Truck profile metrics now reuse the shared KPI card presentation.
- User Management now has Staff Accounts and Admin-only Audit Log tabs. The audit table supports text search and expandable change details.
- Server-side audit events are generated for user creation/access changes, truck creation, delivery creation, and POD uploads/replacements. Passwords and authentication secrets are not recorded.
- System Posture was removed from Settings without replacement content.

## Files and architecture

Primary changes are in the deliveries pages and APIs, `record-detail-drawer.tsx`, `delivery-pod-documents.tsx`, `rounded-select.tsx`, Truck Management/profile pages, User Management, and shared styles. New server audit modules are located at `src/lib/audit/server-audit-store.ts` and `src/app/api/audit/route.ts`.

No database migration was added in this pass. Existing Supabase delivery/document behavior was preserved.

## Permissions

- Audit Log uses the existing `users:manage` server permission and is therefore Admin-only.
- POD viewing retains authenticated `pod:view` access.
- POD upload/replacement retains the existing Admin/Operations server permission.
- Delivery, truck, and user mutations continue to use their established server permission checks.

## Demo flow status

The local flow supports login, dashboard review, owned/subcontracted truck filtering, truck creation with photo preview, opening the new truck profile, multi-stop delivery entry, explicit financial resolution states, pre-save review, saving, opening the centered detail modal, and profitability/report visibility through existing browser-local repositories.

The bundled clients remain Landers, Manila Comisario Central Inc. (MCCI), and Vanguard. Transactions, staff, vehicles, and histories remain explicitly fictional.

## Verification executed

- `npm.cmd run typecheck` - passed.
- `npm.cmd test` - passed, 39 tests, 0 failures.
- `npm.cmd run build` - passed with Next.js 16.4.2/Turbopack; all routes generated successfully.
- No lint script exists in `package.json`, so a separate lint command was not available.
- No live Supabase/database test was run because this workspace is operating in local mode and no production data operation was authorized.

## Remaining issues and decisions

- Initial-form file selectors currently stage filenames in the delivery preview. A transaction spanning delivery creation and multiple private document uploads needs a defined API/storage contract before these files can be claimed as atomically persisted. Existing post-save POD upload remains functional.
- The audit store is server-generated and immutable through the UI, but local mode is process-memory only. Durable Supabase audit storage requires a migration and transactional hooks before production use.
- Full completed-delivery edit mode (with discard warning and audited old/new values) is not yet implemented. The existing audited financial correction/finalization workflow remains intact.
- Admin truck deletion/archive with historical-association blocking is not yet implemented. The current schema does not persist ownership/archive metadata consistently enough to add this safely without a migration decision.
- The dedicated POD page remains in the code and route set for compatibility, as requested previously, but the normal delivery workflow no longer links users to it.
- The date picker/calendar was not redesigned in this pass because it is shared broadly and requires a separate visual regression pass.
- Personnel entry is not currently part of the create-delivery API contract; it should not be added as presentation-only fields.

No commit, push, deployment, destructive database operation, or production-data mutation was performed.
