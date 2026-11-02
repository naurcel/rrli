# RouteX Recommended Next Steps

This plan prioritizes correctness of the completed-delivery record before additional analytics or visual expansion.

## Critical

### 1. Verify the database foundation in a disposable Supabase project

**Why it matters:** Current builds and unit tests do not prove migrations, generated columns, RLS, database functions, or storage policies work in a real environment.

**Work:**

- Apply both migrations without manual weakening of RLS.
- Seed all roles and representative master data.
- Test delivery create/read/POD update as every role.
- Test transaction rollback, unique waybill conflicts, inactive references, and generated financial values.
- Compare PostgreSQL calculations with TypeScript domain calculations.

**Done when:** Repeatable integration tests pass against a disposable migrated project.

### 2. Disable or harden local fallback authentication before deployment

**Why it matters:** Without Supabase configuration, the app accepts plaintext development credentials and signs sessions with a source-code default secret. This is a direct account-forgery risk in any exposed deployment.

**Work:**

- Fail closed in production when Supabase is unavailable.
- Remove the default signing secret; require a strong server-only secret in explicitly approved local/test mode.
- Keep seed credentials out of production bundles and configuration.
- If local accounts remain for development, hash passwords with a suitable password KDF and label the mode clearly.
- Add tests proving production cannot start or authenticate with fallback defaults.

**Done when:** An exposed production build cannot enter local auth or accept any source-defined credential/session secret.

### 3. Replace mixed local/Supabase user management

**Why it matters:** The UI can report account creation or update outcomes that do not match Supabase Auth/profile state.

**Work:**

- Choose one authoritative production provisioning path using a server-only privileged boundary.
- Create Auth user and profile atomically or compensate safely on failure.
- Check and return Supabase update errors.
- Remove production reliance on process-global local accounts and seed-email role fallback.
- Keep local demo authentication explicitly development-only.

**Done when:** Created users survive restart, can authenticate, receive the assigned active role, and failed operations never display success.

### 4. Approve financial completeness rules

**Why it matters:** Unknown expenses currently collapse to zero, which can overstate net income.

**Work:**

- Decide required expenses.
- Model Confirmed Amount, Confirmed Zero, Not Applicable, and Unknown distinctly.
- Block completion/import commitment while required amounts are unknown.
- Approve zero-revenue margin behavior and align TypeScript/PostgreSQL/UI.

**Done when:** Schema, API, UI, reports, and tests use one approved rule set.

### 5. Add concurrency and submission integrity

**Why it matters:** Unique waybill constraints do not fully protect against retries, stale corrections, or duplicate side effects.

**Work:**

- Introduce idempotency keys for creation/import commits.
- Require expected record version on updates.
- Return explicit conflict responses and preserve user input.
- Add transaction-failure and concurrent-request tests.

**Done when:** Retried requests are safe and stale writes cannot silently overwrite newer data.

## High

### 6. Implement completed-delivery detail and correction workflow

**Why it matters:** A records system needs controlled correction without deleting history.

**Work:**

- Add a dedicated delivery detail route.
- Define authorized editable fields and approval requirements.
- Store before/after values, actor, reason, timestamp, and version.
- Lock ordinary editing after completion.
- Expose activity history to authorized users.

**Dependency:** Approved correction rules and concurrency control.

### 7. Implement real POD/document lifecycle

**Why it matters:** Current verification can create a filename-like reference without a real file.

**Work:**

- Upload to private storage with file type/size checks.
- Persist document metadata and uploader.
- Use signed, short-lived download URLs.
- Support Submitted, Verified, Rejected/Needs Correction, notes, and resubmission.
- Apply client-specific requirements.
- Fetch the full queue server-side rather than only 100 deliveries.

**Done when:** Status cannot become verified without valid stored evidence and an authorized review event.

### 8. Implement client and truck master-data management

**Why it matters:** Delivery creation depends on active records, but there is no supported way to create, update, or deactivate them.

**Work:**

- Add authorized CRUD with duplicate prevention.
- Preserve historical snapshots and FK integrity.
- Prevent inactive records from new selection without hiding history.
- Add a practical truck detail/history view only from persisted fields.

### 9. Build the real Excel import workflow

**Why it matters:** Import is a stated operational requirement but is currently explanatory UI only.

**Work:**

- Approve the canonical workbook format first.
- Add private original-file capture and parser.
- Map columns and group multi-store rows.
- Stage rows/cells with validation and editable corrections.
- Match clients/trucks; flag unknown/inactive references.
- Detect duplicate waybills within file and database.
- Confirm and commit valid rows atomically/idempotently.
- Provide batch history and row-level errors.

### 10. Add API and database integration tests

**Why it matters:** Existing 19 tests cover pure logic and policy, not the persistence boundary.

**Work:**

- Delivery GET/POST/PATCH tests.
- RLS matrix for all six roles.
- User provisioning/update tests.
- POD storage and signed-access tests.
- Rollback, duplicate, stale-write, and authorization tests.

## Medium

### 11. Move analytics to server-side aggregate queries

**Why it matters:** `usePersistedDeliveries` fetches every page concurrently and aggregates in the browser.

**Work:** Add authorized date-filtered aggregate endpoints/functions for dashboard, truck profitability, and reports while retaining ledger pagination.

### 12. Expand search intentionally

**Why it matters:** Current ledger search is waybill-only while some copy suggests broader discovery.

**Work:** Decide and implement indexed search across approved fields such as waybill, client, truck plate, store, and document reference; label the control accurately.

### 13. Add structured export

**Why it matters:** Print is available, but CSV/XLSX/PDF generation and auditability are not.

**Work:** Add authorized, date-aware exports using the same server query/financial definitions. Avoid client-only partial exports.

### 14. Correct documentation drift and enforce UTF-8 tooling

**Why it matters:** The existing UI audit describes some workflows as more complete than the current implementation. Diagnostic tools can also show false mojibake if they read valid UTF-8 source using the wrong decoder.

**Work:** Update progress/audit docs to distinguish implementation from plans, retain UTF-8 source conventions, and make repository scripts/tooling read text explicitly as UTF-8 where needed.

### 15. Add browser-level quality checks

**Why it matters:** Responsive, accessibility, dropdown, drawer, theme, and print claims are not covered by current tests.

**Work:** Add Playwright or equivalent checks for login, role routes, creation, filters, POD, reports, mobile shell, keyboard operation, and key accessibility assertions.

### 16. Add linting and CI gates

**Why it matters:** Type-check, tests, and build pass, but no lint command or automated project gate is defined.

**Work:** Add a compatible linter/formatter policy for the installed Next.js version and run typecheck, unit tests, integration tests, lint, and build in CI.

## Low

### 17. Remove verified dead styles and fixtures

**Why it matters:** The 1,449-line global stylesheet includes unused profile/photo/create surfaces, and production domain source contains test fixtures.

**Work:** After browser coverage exists, trace CSS/component usage, extract reusable modules where useful, move fixtures to test data, and remove only proven dead code.

### 18. Refine long-form report and table usability

**Why it matters:** Dense reports and wide tables are functional but can be difficult on smaller screens.

**Work:** Improve column priority, sticky context where appropriate, mobile summaries, and print pagination without changing financial meaning.

### 19. Reconcile informational Settings content

**Why it matters:** Settings currently presents system posture and an access matrix rather than editable settings.

**Work:** Either rename it as an About/Governance page or add only approved, persisted settings. Do not invent configuration fields.

## Recommended development stage boundary

Call the next milestone complete only when these are true:

1. Disposable Supabase migrations and RLS tests pass.
2. Production user provisioning is authoritative and persistent.
3. Financial completeness and correction rules are approved.
4. Completed delivery creation and correction are atomic, idempotent, versioned, and audited.
5. POD evidence uses private storage and a real review lifecycle.

Excel import should follow that boundary because it amplifies every unresolved validation, correction, and duplicate-handling rule.
