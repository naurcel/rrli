# RouteX Comprehensive Project Review

**Review date:** November 2, 2026  
**Reviewed workspace:** `rrliRev`  
**Current scope:** Completed Delivery Management and Truck Profitability  
**Review type:** Read-only code, schema, documentation, and automated-check assessment

## 1. Executive summary

RouteX has been narrowed into a coherent completed-delivery ledger and truck-profitability application. The revised application has a real Next.js frontend, server-enforced API permission checks, Supabase-oriented schema migrations, an atomic delivery-creation database function, persisted delivery queries, shared financial calculations, date-aware dashboards, printable reports, and a store-level POD verification queue.

The application is not production-ready yet. The most important limitation is that the database migrations and Row Level Security policies have not been applied and verified against a disposable Supabase project in this workspace. There is no local Supabase configuration beyond `.env.example`, so database behavior, storage policies, and production authentication could not be exercised during this review.

The strongest implemented path is:

1. An authorized Admin or Operations user opens `/deliveries/new`.
2. The form validates and submits a completed trip with one or more store drop-offs.
3. `POST /api/deliveries` revalidates the request and calls `create_delivery_record`.
4. The database function resolves active references, inserts the delivery and drop-offs atomically, and records activity.
5. The persisted ledger feeds `/deliveries`, `/dashboard`, `/truck-profitability`, and `/reports`.

Important gaps remain:

- Existing completed deliveries cannot be corrected through an authorized, audited correction workflow.
- Excel import is a schema and explanatory UI foundation, not a working import workflow.
- POD management changes status fields but does not upload or securely retrieve files.
- Client and truck master-data management are not implemented.
- User creation and updates are inconsistent in Supabase mode and can report misleading results.
- Local fallback authentication is unsafe for production: accounts are in-memory, development passwords are plaintext in source, and session signing falls back to a source-code default secret.
- No end-to-end or disposable-database integration tests exist.

## 2. Evidence and review boundaries

### Inspected

- Root `AGENTS.md` instructions.
- `README.md`, stage progress documents, design documentation, and the existing UI/UX audit.
- `package.json`, TypeScript configuration, Next.js routes, components, APIs, domain logic, tests, and global CSS.
- Supabase migrations and RLS policies.
- Parent repository Git status and available Git history.

### History limitation

The revised `rrliRev` directory is currently an untracked directory in the parent repository. The available Git commits describe the earlier RouteX application, not the current revised implementation. Therefore, this review cannot provide a reliable commit-by-commit change history for `rrliRev`. The change summary below is reconstructed from current source and project stage documents.

### Not verified

- Supabase migrations applied to a real project.
- RLS behavior against authenticated Supabase users.
- Storage upload/download behavior.
- Browser console, network panel, and responsive screenshots.
- Production deployment or Vercel environment variables.
- Real user-role testing against a shared Supabase project.

No production data, external service, deployment, commit, or push was changed.

## 3. Current architecture

### Runtime and framework

- Next.js `16.4.2` App Router.
- React and React DOM `19.3.0`.
- TypeScript 5.
- Supabase SSR and JavaScript clients.
- Zod validation.
- CSS design system centered in `src/app/globals.css`.

### Application routes

| Route | Purpose | Current status |
|---|---|---|
| `/login` | Authentication entry | Partially functional |
| `/dashboard` | Completed-delivery and profitability overview | Fully functional with persisted data when Supabase is available |
| `/deliveries` | Completed-delivery ledger | Fully functional for read/filter/sort/detail |
| `/deliveries/new` | Create one completed delivery | Partially functional pending database verification |
| `/deliveries/import` | Excel import staging | UI only |
| `/truck-profitability` | Per-truck profitability comparison | Fully functional for computed overview; no dedicated profile route |
| `/pod-documents` | Store-level POD/document status queue | Partially functional |
| `/reports` | Printable operational reports | Partially functional |
| `/user-management` | Admin account and role management | Broken/inconsistent in Supabase mode |
| `/settings` | Scope and role reference | Informational only |

### Backend and persistence

- `src/app/api/deliveries/route.ts` provides authorized delivery reads, creation, and POD-state updates.
- `src/app/api/users/route.ts` provides authorized account listing and local account mutations.
- `src/lib/auth/server-session.ts` resolves authenticated users and verifies API permissions.
- `src/features/deliveries/server/delivery-repository.ts` maps ledger records and query results.
- Supabase migrations define profiles, clients, trucks, deliveries, drop-offs, document requirements, activity, import batches/rows, RLS, and operational database functions.

### Shared calculations

`src/features/deliveries/delivery-domain.ts` centralizes:

- Total expense calculation.
- Net income calculation.
- Profit margin calculation.
- Delivery-level POD state derivation.
- Per-truck profitability aggregation.

The database also generates `total_expenses`, `net_income`, and `profit_margin`, which is appropriate for integrity but creates a need for explicit parity tests between TypeScript and PostgreSQL formulas.

## 4. Summary of changes from the earlier application direction

The current revised application differs from the earlier broad operational prototype in these important ways:

- Scope is explicitly limited to completed deliveries and profitability.
- Pending, scheduled, dispatch, GPS tracking, and in-progress delivery workflows are absent.
- Authentication and six canonical roles are represented in code and schema.
- Completed deliveries use persisted Supabase-oriented tables rather than page-local mock rows.
- A delivery supports multiple ordered store drop-offs under one trip.
- Revenue remains trip-level; store entry fees are aggregated from drop-offs.
- Financial fields now include diesel, tolls, driver/helper rates and allowances, entry fees, and other expenses.
- Dashboard, profitability, and reports consume the same delivery-ledger API through `usePersistedDeliveries`.
- POD state is tracked at drop-off level and aggregated to delivery level.
- Excel import tables and workflow concepts exist in schema, but the parser/review/commit workflow remains unfinished.
- Design documentation and shared shell/components have been added, including date range, rounded select, record drawer, account menu, sidebar, and theme behavior.

## 5. Functional status matrix

Status terms follow the requested definitions: **Fully functional**, **Partially functional**, **UI only**, **Broken**, **Not implemented**, and **Needs confirmation**.

### Authentication and roles

| Feature | Status | Evidence and caveats |
|---|---|---|
| Login and logout | Partially functional | Supabase auth is used when configured; otherwise a signed HttpOnly local session is used. Supabase was not configured during review. |
| Forgot password | Partially functional | Calls Supabase reset when configured and uses a non-enumerating response; redirect ends at `/login`, but the password-update completion flow is not implemented. |
| Protected routes | Partially functional | Local-cookie proxy checks role access. Supabase proxy checks authentication only; page/API guards provide additional enforcement, but proxy behavior is inconsistent. |
| Server API authorization | Fully functional in code | Delivery and user APIs call `verifyServerPermission`. Automated RBAC tests pass. Live Supabase/RLS verification is still required. |
| Six-role permission mapping | Fully functional | Admin full; Operations operational write; Finance, HR, Secretary, and Customer Representative view-only. Unit tests cover this mapping. |
| User listing | Partially functional | Reads `user_profiles` when available, otherwise local accounts. Empty Supabase result falls back to seed accounts, which can be misleading. |
| User creation | Broken in Supabase mode | `POST /api/users` creates only an in-memory local account and does not create a Supabase Auth user/profile. |
| User role/status update | Broken in Supabase mode | Database update errors are ignored, then a local registry update is required. A Supabase-only user can be updated in the database and still receive a 404 response. |
| Local account persistence | Not implemented | Local account mutations live in a process-global `Map` and are lost on restart or serverless instance change. |

### Completed delivery management

| Feature | Status | Evidence and caveats |
|---|---|---|
| List completed deliveries | Fully functional with configured database | Server-side query, filters, sort, pagination, loading, empty, and error states are present. |
| Create completed delivery | Partially functional | UI and API exist; database RPC is atomic. Requires migration and live database verification. |
| Multiple store drop-offs | Fully functional in model/code | One delivery owns ordered drop-offs. Revenue is not duplicated; entry fees are summed. Unit test covers this calculation. |
| Waybill uniqueness | Fully functional at schema level | Unique database constraint and conflict response exist. Live concurrency behavior is not tested. |
| Client/truck assignment | Partially functional | Creation resolves active client/truck records. There is no client/truck management UI. |
| Inactive reference behavior | Fully functional in design | New records use active references; historical FKs remain valid. Requires live RLS/database confirmation. |
| Search | Partially functional | Delivery ledger search is waybill-only, despite UI language elsewhere suggesting broader search. |
| Filters and sorting | Fully functional | Date, client, truck, delivery status, POD status, supported sort columns, and pagination are passed to the API. |
| Delivery detail | Partially functional | Read-only drawer shows drop-offs and financial breakdown. There is no dedicated detail route. |
| Edit/correction workflow | Not implemented | No authorized correction API/UI, approval, stale-write handling, or correction audit flow exists. |
| Audit history | Partially functional | Creation and POD updates write `delivery_activity`; no user-facing audit history or correction trail exists. |
| Duplicate submission protection | Partially functional | Waybill uniqueness prevents duplicate records, but no idempotency key or replay mechanism exists. |

### Truck profitability

| Feature | Status | Evidence and caveats |
|---|---|---|
| Revenue, expenses, net income | Fully functional in shared domain logic | Dashboard, truck page, and reports use the same persisted ledger and shared aggregation. |
| Profit margin | Needs confirmation | Formula is net income / revenue. TypeScript returns `0` when revenue is zero; PostgreSQL returns `NULL`. Decide whether the UI should show `N/A`. |
| Multiple-store revenue integrity | Fully functional | Revenue is trip-level and is not multiplied by drop-off count. Test coverage exists. |
| Truck comparison table | Fully functional | Date-aware summary and sortable table are present. |
| Truck rankings | Partially functional | Dashboard ranks by net income only. Switching among revenue/net income/margin is not implemented in this revision. |
| Dedicated truck profile | Not implemented | Clicking a truck opens a drawer; there is no `/truck-profitability/[truck]` route, delivery-history table, profile actions, or persisted photo. |
| Server aggregate scalability | Partially functional | Shared hook fetches every ledger page concurrently and aggregates in the browser. Correct for modest data, inefficient for large datasets. |

### POD and document management

| Feature | Status | Evidence and caveats |
|---|---|---|
| Missing/verified queue | Partially functional | Reads completed deliveries and flattens store drop-offs. Only the first 100 deliveries are fetched. |
| Verify/unverify store documents | Partially functional | Authorized PATCH updates booleans/reference and aggregate POD state through a database function. |
| Real file upload | Not implemented | No file input, storage upload, MIME/size validation, or upload progress. |
| Private file access | Schema only | Private bucket and policies exist in migration; signed download flow is absent and untested. |
| Submitted/rejected/correction-required review | Not implemented in UI | Schema supports richer document status, but the page treats a document as a binary complete/incomplete state. |
| Client-specific requirements | Schema only | `client_document_requirements` exists but is not used by the UI or verification logic. |
| Document reference integrity | Broken as document evidence | The UI generates a filename-like string when marking complete; it does not prove a file exists. |

### Excel import

| Feature | Status | Evidence and caveats |
|---|---|---|
| File upload | Not implemented | No input or upload endpoint. |
| Spreadsheet parsing | Not implemented | No parser dependency or service. |
| Column mapping | Not implemented | Only descriptive UI exists. |
| Editable staged preview | UI only | Page describes the intended workflow; no rows are loaded or edited. |
| Validation/matching/deduplication | Schema only | Batch and row tables exist; no execution workflow. |
| Final confirmation/save | Not implemented | No API or database function for batch commit. |
| Import history/errors | Not implemented | Tables can store state, but no history UI exists. |

### Dashboard, reports, and search

| Feature | Status | Evidence and caveats |
|---|---|---|
| Dashboard KPIs | Fully functional with persisted data | Revenue, expenses, net income, margin, stores, POD follow-up, recent trips, and top trucks derive from the ledger. |
| Global date range | Fully functional in client flows | Dashboard, reports, profitability, and POD apply the shared range. |
| Recent delivery detail | Fully functional | Dashboard rows open the shared detail drawer. |
| Reports | Partially functional | Three report tabs derive from persisted ledger and print through `window.print()`. No CSV/XLSX/PDF generation or saved report history. |
| Global search | Not implemented | Search is scoped to the delivery ledger and only to waybill. |
| Export | Not implemented | No actual structured export. Print is the only output action. |

## 6. Data and financial integrity findings

### Verified strengths

- A delivery references one client and one truck through foreign keys.
- Drop-offs reference one delivery and have a unique sequence per delivery.
- Waybill uniqueness is enforced in PostgreSQL.
- Financial values are constrained to nonnegative values in the current completed-delivery model.
- `create_delivery_record` performs delivery, drop-off, and activity insertion in one database function call.
- Revenue is stored once per trip and is not repeated for each store.
- Total entry fees are derived from drop-offs.
- Total expenses and net income are generated columns in the database.
- Creation requires a positive delivery rate and at least one drop-off.

### Risks and inconsistencies

1. **Unknown expenses become zero.** The creation form and repository coerce missing or invalid numeric values to `0`. The model does not distinguish confirmed zero, not applicable, and unknown. This is a business and financial-integrity decision, not merely a UI issue.
2. **Profit margin zero behavior differs.** TypeScript returns `0%` when revenue is zero; PostgreSQL returns `NULL`. A single presentation rule is needed.
3. **No stale-write protection.** Delivery rows have a `version`, but current mutations do not require the caller's expected version.
4. **No correction transaction.** Completed records cannot be corrected through an auditable workflow.
5. **Repository coercion can hide malformed values.** `asNumber` converts unexpected/null values to zero rather than failing closed.
6. **Dashboard page summaries are client aggregates.** They are built after fetching every page. This is consistent for current data but can become expensive and fragile at scale.
7. **No database parity tests.** TypeScript financial calculations are tested, but generated PostgreSQL values are not compared against them.

## 7. Security and permission findings

### Positive controls

- Auth sessions are resolved on the server.
- Local sessions use a signed HttpOnly cookie.
- Open return-path redirects are sanitized.
- API mutations verify permissions server-side.
- View-only roles are denied operational mutations in RBAC tests.
- Supabase tables include RLS policies.
- Public environment parsing rejects `service_role` keys.
- Admin self-deactivation and self-demotion are blocked in the user API.

### Critical and high-risk findings

1. **Supabase-mode user management is not reliable.** Account creation does not provision Supabase Auth. Update errors are ignored and responses can contradict database state.
2. **Seed-email role fallback is too permissive for production.** A Supabase user matching a development seed email can inherit its role if no profile/app metadata is available.
3. **The local session signer has a hardcoded fallback secret.** If Supabase is not configured and `ROUTEX_SESSION_SECRET` is absent, production uses a secret visible in source. Anyone with the source could forge a local session token. `.env.example` does not document this variable.
4. **Development passwords are plaintext.** The field is named `passwordHash`, but values are plaintext and compared directly. This mode must be development-only and unavailable in production.
5. **Local account mutations are nonpersistent.** Serverless deployments can show different account state across requests/instances.
6. **Supabase proxy does not enforce roles.** It only verifies authentication. APIs and the user-management layout still check permissions, but request-boundary behavior differs between auth modes.
7. **Storage security is unverified.** Policies exist in SQL, but no live test proves upload/read isolation.
8. **No idempotency or stale-conflict tests.** Unique waybill constraints help, but they are not a complete duplicate-submission strategy.

## 8. UI/UX and design findings

### Consistent areas

- Shared application shell, sidebar, topbar, theme handling, date range picker, selects, notices, tables, KPI cards, and detail drawer.
- Clear completed-delivery and profitability focus.
- Loading, empty, and error states exist on core data pages.
- Tables are wrapped for horizontal scrolling.
- Focus-visible and reduced-motion styles exist.
- Light and dark design tokens are documented.

### Inconsistencies and risks

1. **The UI audit is partly stale.** It describes an Excel staged-table preview and POD upload/view triggers that do not exist as working features.
2. **`globals.css` is oversized.** It is 1,449 lines and includes styles for profile/photo/create surfaces not used by current routes. This increases regression risk, but cleanup should follow usage verification rather than be done blindly.
3. **Search labeling is broader than behavior.** The delivery API searches waybill only.
4. **No browser-level verification was possible in this pass.** Responsive and visual claims in existing documents should be manually rechecked.
5. **Native select behavior may differ by OS.** The design audit already notes this; it remains relevant.

The source files checked use valid UTF-8 punctuation. PowerShell's default `Get-Content` decoding displayed false mojibake during one diagnostic command; reading explicitly as UTF-8 and searching the source confirmed that this was a terminal-decoding artifact, not an application defect.

## 9. Technical health and validation results

### Commands run on November 2, 2026

| Command | Result |
|---|---|
| `npm.cmd run typecheck` | Passed, exit code 0 |
| `npm.cmd test` | Passed: 19 tests, 0 failures |
| `npm.cmd run build` | Passed; all 17 listed app/API routes compiled |

### Test coverage present

- RBAC role and permission mapping.
- Route access and safe return paths.
- Signed session token integrity and local account permission guard.
- Environment variable validation.
- Delivery financial/POD domain calculation.
- Delivery query parsing, date validation, sorting, and pagination.

### Missing validation

- No lint script is configured.
- No component tests.
- No browser/end-to-end tests.
- No Supabase integration tests.
- No RLS policy tests.
- No database transaction rollback tests.
- No storage upload/access tests.
- No API tests for delivery creation/POD update/user management.
- No accessibility automation.
- No performance/load tests.

### Maintainability observations

- `usePersistedDeliveries` requests all pages concurrently; a large page count can create a request burst.
- Domain fixtures remain in production source and are used only by tests.
- Current docs contain both accurate progress notes and stale/overstated UI claims.
- The revised app is not yet tracked in parent Git history, which makes review and rollback harder.

## 10. Unresolved business rules

These questions cannot be answered safely from current code and documents:

1. Which expenses are mandatory for every completed trip?
2. Must a user explicitly mark each expense as confirmed zero, not applicable, or unknown?
3. Should a zero-revenue record be allowed, and should its margin display as `N/A`?
4. Who may correct a completed delivery, and does correction require a second approver?
5. Which fields remain editable during correction, and must the original values remain visible?
6. How should voided, duplicate, or invalid completed records be retained and reported?
7. Which POD/supporting documents are required per client and per store?
8. Are document states Submitted, Verified, Rejected, and Needs Correction all required?
9. Can one uploaded document satisfy multiple drop-offs?
10. What happens to historical labels when a client or truck name/type changes?
11. What is the expected Excel template, and how are multiple stores encoded in it?
12. Should Finance remain strictly view-only, or approve/correct financial records?
13. What are the retention periods for delivery activity, imports, and documents?

## 11. Recommended next stage

The next stage should be **Database-verified completed-delivery operations**, not additional dashboard expansion.

Recommended sequence:

1. Apply migrations to a disposable Supabase project and validate RLS, functions, generated financial columns, and storage policies.
2. Replace the current mixed user-management implementation with one authoritative Supabase Admin provisioning flow.
3. Decide and document expense, zero-revenue, correction, and document rules.
4. Implement the authorized completed-delivery correction/detail workflow with optimistic concurrency and immutable activity history.
5. Implement real POD upload, private download, review, rejection, and client requirements.
6. Build Excel import only after the canonical template and correction rules are approved.

The prioritized task list is in `docs/reviews/RECOMMENDED_NEXT_STEPS.md`. Manual pass/fail procedures are in `docs/reviews/PERSONAL_VERIFICATION_CHECKLIST.md`.
