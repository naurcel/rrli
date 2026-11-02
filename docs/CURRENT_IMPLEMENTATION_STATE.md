# RouteX Current Implementation State

**Verified:** 2026-10-30  
**Authority:** current repository source and `package.json` take precedence over older planning documents and dated engineering reports.

## What RouteX is today

RouteX is a frontend-first Next.js application for reviewing local, synthetic logistics records. It is a functional interface preview with browser-local creation flows and temporary sign-in handling; it is not yet a production operational system or a connected database application.

## Verified stack

- Next.js 16.4.2 App Router and React 19.3.0.
- TypeScript 5, Tailwind CSS 4, and a shared custom CSS design system in `src/app/globals.css`.
- Supabase JavaScript and SSR packages are installed for a future integration boundary. No Supabase project, schema, migration, data query, storage bucket, or RLS policy is configured in this repository.
- Zod 4 is used for the existing authentication form contract.
- Node's built-in test runner is the active automated test tool. Vitest, Jest, shadcn/ui, and Lucide are not installed.

## Implemented interface and local interactions

| Area | Verified behavior | Boundary |
|---|---|---|
| App shell | Shared sidebar, two explicit expanded/collapsed states, shared date-range control, theme toggle, responsive records layout | Sidebar state and theme preference are browser-local preferences. |
| Login and route gate | Local development preview entry; hosted unconfigured builds require the temporary `admin / admin` preview credentials; configured builds use Supabase password sign-in | This is not RBAC and is not a production identity policy. |
| Dashboard | Date-aware local delivery metrics, revenue chart, top-truck ranking, attention link, quick actions, sortable recent-delivery table, detail drawer | Metrics derive from local fixture deliveries only. Financial definitions remain provisional. |
| Deliveries | Search, date/POD/client/truck/driver filtering, three-state sorting, detail drawer, and local create form | Created records are browser-local and do not yet reconcile into every screen. |
| Fleet | Owned-truck cards, 50 synthetic subcontracted-truck rows, filters/sorting, truck profiles, local truck creation, and browser-local photo crop/upload | Truck totals and photos are local. No maintenance, document, or history service exists. |
| Transactions | Search, filters, sorting, KPI cards, detail drawer, and local create form | Entries are browser-local. Posting, reconciliation, and approved accounting logic are absent. |
| Reports | Date-aware local report document tabs and print/save-PDF browser action | Export formats, authorization, generated files, scheduling, and official-report definitions are not implemented. |
| Administration | Local members table and integrated local audit-trail view | Member management, RBAC, retained auditing, invitations, and permissions are not implemented. |
| Settings | Intentional work-in-progress placeholder | There is no settings data model or persistence. |

## Current data and persistence boundary

The app currently has several local fixture sources:

- Dashboard/report delivery fixture: `src/features/dashboard/dashboard-preview-data.ts`.
- Deliveries and transactions: page-level fixture arrays plus separate browser-local creation modules.
- Fleet: fixture owned trucks, 50 generated subcontracted trucks, separate browser-local created trucks, and per-truck browser-local photos.
- Administration and audit: separate local member and audit-event fixtures.

Those sources are not yet a single central mock database. The proposed `mock-db.json` / seed / store / selector / async API architecture is documented as a pending design decision; do not claim cross-screen persistence or audit-on-write until that migration is approved and completed.

## Validation last run against the current frontend work

```text
npm.cmd run typecheck  -> passed
npm.cmd test           -> passed (28 tests)
npm.cmd run build      -> passed
```

No browser automation suite or configured remote Supabase/Vercel environment was available for this verification.

## Explicitly not implemented

- Production database, schema, migrations, server-side CRUD, or storage.
- RBAC, row-level security, final session lifecycle, invitations, password recovery, or user management.
- Approved delivery lifecycle/status rules, POD document policy, financial formulas, reconciliation, correction/void workflow, or official reporting/export.
- Persistent/immutable audit trail, backup/recovery, or production monitoring.

## Documentation use

Use this page for the present implementation state. Keep dated reports and agent-session logs as historical evidence rather than editing their original claims. Product requirements, architectural decisions, and open questions remain governed by the Knowledge Base and Development Kit until explicitly approved.
