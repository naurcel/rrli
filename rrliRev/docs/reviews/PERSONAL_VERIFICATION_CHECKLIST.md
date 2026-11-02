# RouteX Personal Verification Checklist

**Use this checklist against a disposable Supabase project. Do not use production data.**

Record the browser, viewport, role, date range, waybill, and truck used for each failed check. A feature should not be accepted only because its page renders.

## A. Environment setup

- [ ] **Apply both migrations to a disposable Supabase project.**  
  **Do:** Apply `20261101000000_routex_revised_foundation.sql` and `20261101010000_stage2_delivery_management.sql`; configure only the public URL and publishable key.  
  **Expect:** Tables, views, functions, enums, RLS policies, and private bucket are created without manual edits.  
  **Problem if:** Migration fails, RLS must be disabled, a service-role key is placed in a public variable, or generated columns/functions differ from source.

- [ ] **Create one test account for each canonical role.**  
  **Do:** Create Admin, Operations, Finance, HR, Secretary, and Customer Representative profiles through an approved admin process.  
  **Expect:** Each account resolves the intended active role after login.  
  **Problem if:** A role comes from a client selection, seed email fallback, user metadata, or an account without an active profile.

- [ ] **Confirm production cannot enter local fallback auth.**  
  **Do:** Start a production-like build without Supabase variables and without a session secret.  
  **Expect:** After remediation, startup/authentication should fail closed; the current code instead enables source-defined local accounts and a source-code signing secret.  
  **Problem if:** A deployed environment accepts local development credentials or signs sessions with a default secret.

- [ ] **Seed test master data.**  
  **Do:** Add at least two clients, one active and one inactive truck, and enough records to exceed 100 deliveries.  
  **Expect:** Active references are available for new records; inactive references remain readable historically.  
  **Problem if:** Inactive references can be selected for a new trip or historical rows disappear.

## B. Things to visually inspect

- [ ] **Login in split and centered layouts.**  
  **Do:** Open `/login` in light/dark mode at desktop and mobile widths.  
  **Expect:** Logo, GIF, fields, eye control, layout switch, and focus states remain readable without clipping.  
  **Problem if:** Controls overlap, the visual collapses, text is unreadable, or role presets imply production authorization.

- [ ] **Workspace shell and navigation.**  
  **Do:** Visit every route with the sidebar expanded and collapsed.  
  **Expect:** Active state, icon spacing, date picker, account control, theme, and content width remain consistent.  
  **Problem if:** Sidebar state jumps, content is covered, dates are clipped, or links appear for unauthorized roles.

- [ ] **Character rendering.**  
  **Do:** Inspect Settings, Reports, Excel Import, error notices, role labels, and back links.  
  **Expect:** Proper arrows, middle dots, dashes, locks, and peso symbols.  
  **Problem if:** Text shows replacement glyphs or mojibake. The checked source is valid UTF-8, so a failure would point to browser/response/tooling encoding rather than the reviewed strings.

- [ ] **Delivery ledger.**  
  **Do:** Inspect empty, loading, populated, error, and narrow-screen states.  
  **Expect:** Columns remain distinguishable, horizontal scroll is intentional, pagination is visible, and the drawer does not obscure critical context.  
  **Problem if:** Rows overlap, controls resize unexpectedly, or totals appear to represent all records when labeled as a page summary.

- [ ] **New delivery form.**  
  **Do:** Review the form with one and several drop-offs, long client/store names, and validation errors.  
  **Expect:** Financial review is readable; each store and entry fee remains associated; error text identifies the field.  
  **Problem if:** Invalid numeric text silently appears as a confirmed zero or submission loses entered values.

- [ ] **Truck profitability page.**  
  **Do:** Compare table, KPI totals, and drawer at multiple ranges.  
  **Expect:** Revenue, expenses, net income, and margin have clear labels and match delivery records.  
  **Problem if:** Revenue is called margin/profit, rankings do not match figures, or zero-revenue margin is misleading.

- [ ] **POD queue.**  
  **Do:** Inspect Verified, Needs Follow-up, and All filters.  
  **Expect:** Store-level status is clear and delivery aggregate status is understandable.  
  **Problem if:** A filename-like reference looks like proof of a real uploaded file.

- [ ] **Reports and print preview.**  
  **Do:** Open all three tabs, change date range, then print preview.  
  **Expect:** Period, trip counts, totals, rows, and print layout agree with the ledger.  
  **Problem if:** Sidebar/actions print, totals differ, text is garbled, or the report implies an official generated file.

- [ ] **User management.**  
  **Do:** Inspect form/table with long names and emails.  
  **Expect:** Role, access level, status, and action remain clear.  
  **Problem if:** UI success suggests a Supabase account was provisioned when it was only stored in memory.

## C. Things to test manually

### Authentication and permissions

- [ ] **Unauthenticated direct URLs.**  
  **Do:** In a signed-out browser, open `/dashboard`, `/deliveries/new`, `/deliveries/import`, `/pod-documents`, `/reports`, and `/user-management`.  
  **Expect:** Redirect to `/login` with a safe return path.  
  **Problem if:** Protected content renders or an API returns data.

- [ ] **Admin access.**  
  **Do:** Log in as Admin and visit every route.  
  **Expect:** Full access, including user management and operational mutations.  
  **Problem if:** A legitimate route is blocked or an action succeeds only in the UI but not on the server.

- [ ] **Operations access.**  
  **Do:** Create a delivery, open import, and update POD; then request `/user-management` and `/api/users` directly.  
  **Expect:** Operational actions allowed; user management denied with redirect/403.  
  **Problem if:** Operations can manage accounts.

- [ ] **View-only roles.**  
  **Do:** Repeat with Finance, HR, Secretary, and Customer Representative, including direct API calls.  
  **Expect:** Read routes work; creation, import, POD mutation, and user management return 403.  
  **Problem if:** Hiding a button is the only protection.

- [ ] **Deactivated account.**  
  **Do:** Deactivate a test user, then reuse/refresh its session.  
  **Expect:** Access ends promptly and protected APIs return 401.  
  **Problem if:** A stale session retains access.

- [ ] **Session secret enforcement.**  
  **Do:** Verify the deployed environment uses Supabase-only auth, or a unique server-only `ROUTEX_SESSION_SECRET` for an explicitly approved local test environment.  
  **Expect:** No default signing secret and no client-visible secret.  
  **Problem if:** Authentication works in production with neither Supabase nor a unique secret configured.

- [ ] **Forgot password.**  
  **Do:** Request reset for known and unknown emails and follow a real Supabase reset link.  
  **Expect:** Same non-enumerating response.  
  **Problem if:** The final password-update flow cannot complete; current code only redirects to `/login`.

### Completed delivery workflow

- [ ] **Create one valid completed delivery.**  
  **Do:** Use an active client/truck, unique waybill, actual date, one store, rate, and expenses.  
  **Expect:** One delivery, one drop-off, generated totals, and one activity event are committed.  
  **Problem if:** Partial rows remain after failure or totals differ from the review.

- [ ] **Create a multi-store delivery.**  
  **Do:** Add three stores with different entry fees.  
  **Expect:** One trip-level rate, three drop-offs, summed entry fees, and no multiplied revenue.  
  **Problem if:** Revenue triples or store sequence/fees are misplaced.

- [ ] **Duplicate waybill.**  
  **Do:** Submit the same waybill twice, including two near-simultaneous submissions.  
  **Expect:** One record; duplicate receives a clear conflict and preserves form input.  
  **Problem if:** Two records exist or the UI announces success before server confirmation.

- [ ] **Inactive and missing references.**  
  **Do:** Attempt creation with an inactive/deleted client or truck through a crafted API request.  
  **Expect:** Server rejects it.  
  **Problem if:** Client-side select restrictions are the only guard.

- [ ] **Invalid financial input.**  
  **Do:** Try negative, empty, malformed, infinite, and very large values.  
  **Expect:** Server rejects invalid values with field-specific feedback.  
  **Problem if:** Unknown/invalid input becomes `0` without confirmation.

- [ ] **Edit/correct a completed delivery.**  
  **Do:** Look for an authorized correction action.  
  **Expect today:** No workflow exists. Record this as a known failure, not a passed test.  
  **Problem if:** Ordinary fields can be silently overwritten without immutable history.

### Ledger, search, filters, and dates

- [ ] **Waybill search.**  
  **Do:** Search complete and partial waybill text.  
  **Expect:** Matching records only.  
  **Problem if:** UI claims client/truck search; the current API only supports waybill search.

- [ ] **Combined filters.**  
  **Do:** Combine date, client, truck, POD, and status filters.  
  **Expect:** Intersection of all selected filters, page resets to 1, and URL/server request values match.  
  **Problem if:** A stale page is empty when earlier pages contain matches.

- [ ] **Sort and paginate.**  
  **Do:** Sort every enabled column in both directions across several pages.  
  **Expect:** Stable server ordering and no duplicated/missing rows between pages.  
  **Problem if:** Sorting applies only to the visible page.

- [ ] **Date boundary.**  
  **Do:** Create trips on start/end dates and change timezone/browser locale.  
  **Expect:** Inclusive business-date filtering with no one-day shifts.  
  **Problem if:** UTC conversion excludes a boundary date.

### Profitability and reports

- [ ] **Manual financial reconciliation.**  
  **Do:** For one truck, sum delivery rates and all expense categories independently.  
  **Expect:** Net income = revenue - expenses; margin = net income / revenue × 100.  
  **Problem if:** Store count changes revenue or dashboard/report/truck page disagree.

- [ ] **Negative and zero cases.**  
  **Do:** Use approved test data for a loss and, if allowed, zero revenue.  
  **Expect:** Loss stays negative. Zero-revenue margin follows the approved `N/A` or `0%` rule consistently.  
  **Problem if:** Losses are hidden or ranked as gains.

- [ ] **Large dataset behavior.**  
  **Do:** Load enough records for many API pages.  
  **Expect:** Dashboard/report totals include all authorized rows without request failures.  
  **Problem if:** Concurrent page fetching creates timeouts or partial totals.

### POD and documents

- [ ] **Status update authorization.**  
  **Do:** Verify and unverify a store as Operations; repeat as Finance.  
  **Expect:** Operations succeeds and writes activity; Finance receives 403.  
  **Problem if:** UI state changes without a confirmed server response.

- [ ] **More than 100 deliveries.**  
  **Do:** Place a missing POD after the first 100 records.  
  **Expect today:** It may not appear; the page only fetches page 1. Treat as a known failure.  
  **Problem if:** The interface implies the queue is complete.

- [ ] **Real document evidence.**  
  **Do:** Try to upload, download, reject, and annotate a POD.  
  **Expect today:** These actions are unavailable. Treat as known missing functionality.  
  **Problem if:** Generated text such as `POD-...pdf` is mistaken for a stored file.

### Excel import

- [ ] **Attempt a real `.xlsx` import.**  
  **Do:** Open `/deliveries/import` and try upload, mapping, editing, validation, confirmation, and history.  
  **Expect today:** No real workflow exists.  
  **Problem if:** Stakeholders consider the explanatory page production-ready.

### User management

- [ ] **Create user in Supabase mode.**  
  **Do:** Create a test account, restart the app, and log in from another browser.  
  **Expect today:** This is likely to fail because POST only creates an in-memory local account.  
  **Problem if:** UI displays success but no Supabase Auth user/profile exists.

- [ ] **Update Supabase-only user.**  
  **Do:** Change its role/status and inspect database plus API response.  
  **Expect today:** Response may be inconsistent because the local registry update is required.  
  **Problem if:** The database changes while UI reports failure, or errors are silently ignored.

## D. Business decisions to confirm

- [ ] Define mandatory expense categories for every completed trip.
- [ ] Decide how Confirmed Zero, Not Applicable, and Unknown are represented.
- [ ] Approve the zero-revenue and profit-margin display rule.
- [ ] Define completed-record correction roles, approvals, and immutable history.
- [ ] Define void/cancel/duplicate retention without reintroducing live delivery statuses.
- [ ] Approve client-specific POD and supporting-document requirements.
- [ ] Define document review states, rejection notes, and resubmission behavior.
- [ ] Define whether one document may satisfy several store drop-offs.
- [ ] Define the canonical Excel workbook/columns and multi-store representation.
- [ ] Define client/truck rename and deactivation behavior for historical snapshots.
- [ ] Confirm whether Finance remains fully view-only.
- [ ] Approve activity, import, and document retention periods.
