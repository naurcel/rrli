# RouteX: System Features and Access Control Reference

**System:** RouteX: A Truck Profitability and Delivery Operations Management System  
**Client:** Redeemed Route Logistics Inc. (RRLI)  
**Purpose:** Feature specification and role-based access-control reference  
**Status:** Working reference for review. It describes intended scope and candidate operations, not proof that every feature is implemented.

---

## 1. How to read this document

This file combines the feature inventory with proposed permissions for each user role. It is based on the current RouteX project documents and the available `RtX_-prototype-z(4).html` interface prototype.

The project documents describe intended system behavior, while the HTML prototype demonstrates only some screens and interactions using sample data. A feature shown in a prototype is not necessarily connected to a production database or implemented with secure server-side permissions.

### Access indicators

| Indicator | Meaning |
|---|---|
| **Manage** | Can create and update records in that area, subject to field-level restrictions. |
| **View** | Can view records or summaries permitted for that role. |
| **Limited** | Access is restricted to the role's work needs or selected fields. |
| **TBD** | The exact permission or behavior needs client/team approval. |
| **No access** | Not expected to use that module as part of the current proposed role. |
| **Proposed** | A useful operation or control that should be confirmed before it is treated as a committed requirement. |

**Confirmed deletion and correction policy: preserve history.** Do not permanently delete operational or financial records that may be needed for historical reporting, accountability, or audit. Use controlled correction, void/reversal, or archive actions instead, with an audit trail. Deactivate trucks, employees, and user accounts when they should no longer be active; retain their historical links. A voided record must remain identifiable as voided and must be excluded from current totals according to the relevant calculation rules, without erasing the original record. Restrict these actions by role and require a reason for voids/reversals and material corrections. Audit entries should capture the actor, timestamp, action, affected record, reason, and before/after values where applicable. The exact implementation and any legal retention period still need to be configured and tested.

**Permission enforcement:** These permissions are a proposed access-control baseline. They must be enforced on the server for record reads, edits, exports, and file access, not only by hiding buttons in the interface.

## 2. User roles

The user-confirmed role list for this working specification is:

| Role | Main responsibility |
|---|---|
| **Admin** | Manages user accounts, approved roles/permissions, system administration, and authorized audit access. Admin status does **not** automatically grant permission to edit financial records. |
| **President** | Reviews company, truck, and delivery profitability, searches records, and reviews authorized reports. |
| **Corporate Secretary** | Role is confirmed to exist, but its exact module permissions and responsibilities still need definition. Access is limited to explicitly approved permissions until then. |
| **Operations** | Records completed deliveries, links trucks/clients/crew, maintains delivery information and POD documents, and corrects operational records when authorized. |
| **Finance** | Records company expenses not directly attributable to a specific delivery and can edit delivery financial entries under the current provisional approval. |
| **HR** | Maintains employee/crew reference information as assigned and records compensation amounts payable or period summaries for staff, drivers, and helpers. |

These six role names replace the earlier draft role list. The access matrix is provisionally approved for planning, but Corporate Secretary permissions and any field-level restrictions still need definition. Do not infer additional roles from the prototype.

## 3. High-level access matrix

This matrix gives a quick overview. Detailed submodule operations follow in Section 4.

| Module | Admin | President | Corporate Secretary | Operations | Finance | HR |
|---|---|---|---|---|---|---|
| Dashboard | View system/access info; business metrics TBD | View overall authorized metrics | TBD, approved view access only | Limited operational view | Limited financial view | Limited compensation view |
| Delivery Management | No routine edit rights | View | TBD | Manage completed delivery records | View and edit delivery financial fields | Limited crew-reference access, TBD |
| Fleet Management | No routine edit rights | View | TBD | Manage truck records and assignments | View relevant truck cost context, TBD | View crew references as needed, TBD |
| Delivery Revenue and Expenses | No financial-edit rights by default | View | TBD | View and edit delivery financial entries | View and edit delivery financial entries | No routine access |
| POD Management | Administer access/security; document access only if authorized | View authorized PODs | TBD | Upload and view for operational needs | View if required, TBD | No routine access, TBD |
| Company Expenses / Transactions | No financial-edit rights by default | View | TBD | No routine management | Manage | No routine access |
| HR Compensation Summaries | No default access to sensitive compensation details | View authorized summaries | TBD | No routine access to compensation amounts | View for approved reconciliation, TBD | Manage |
| Search and Record Retrieval | Admin/audit records; business search TBD | Search permitted company records | TBD | Search operational records | Search finance/approved records | Search employee/compensation records |
| Profitability Analysis | No default financial-edit rights | View delivery, truck, and company results | TBD | Delivery-level view as permitted; broader views TBD | Review profitability as approved; edit delivery financial entries | No routine access to profitability amounts |
| Reports and Exports | Administration/audit reports | View/export permitted reports | TBD | Operational reports | Financial and expense reports | Compensation summaries as permitted |
| User and Access Management | Manage users and approved roles | View accounts only if approved | No by default, TBD | No | No | No |
| Audit and Activity Logs | View/manage audit access | Selected audit information, TBD | TBD | Own/relevant actions, TBD | Own/relevant actions, TBD | Own/relevant actions, TBD |
| Settings and Personal Preferences | Own preferences; system-wide settings only if approved | Own preferences | Own preferences | Own preferences | Own preferences | Own preferences |

> **Access-control principle:** Management review access and administrator privileges are separate. A system administrator must not automatically gain edit access to delivery revenue, expenses, or HR compensation records.

## 4. Module and submodule specifications

## 4.1 Dashboard

**Purpose:** Give authorized users a useful summary for the selected period and links to the records behind the summary.

### 4.1.1 Summary metrics
- **View:** Display only metrics allowed for the user's role.
- **Filter:** Apply the selected date range where the metric is time-based.
- **Drill down:** Open the permitted list or report behind a number, where supported.
- **Add/edit/delete:** Summary metrics are calculated from source records, not entered directly on the dashboard.
- **Rules:** Derived totals should use the same approved financial logic as reports. Dashboard metrics must not introduce a separate version of a formula.

**Access:** President: view overall authorized metrics. Operations: limited operational metrics. Finance: limited financial metrics. HR: limited compensation-related metrics. Corporate Secretary: TBD. Admin: system/access information; business metric access is TBD.

### 4.1.2 Recent deliveries
- View recent delivery IDs, client, status, truck, margin, and POD state as permitted.
- Open a delivery record.
- Navigate to the full delivery list.
- Search or filter through Delivery Management.

**Access:** Operations: view/manage operational records. President / Management: view. Finance: limited financial context, TBD. HR: no routine access beyond crew-related information, TBD. System Administrator: no routine access by default.

### 4.1.3 Attention-needed items and notifications
Candidate items shown in the prototype include delayed deliveries, missing PODs, and incomplete financial records.
- View active attention items available to the role.
- Open the relevant record or a filtered list.
- Review missing information and route the issue to the responsible department.
- Clear an item only by resolving its source condition, not by hiding the warning.

**Status:** Missing-POD and incomplete-record cues are proposed improvements unless confirmed in the accepted scope. Notification rules and acknowledgement behavior are TBD.

**Access:** Operations: operational/POD issues. Finance: financial-record issues. HR: compensation issues if implemented. President / Management: review overall issues. System Administrator: system alerts; business alerts TBD.

### 4.1.4 Top trucks and revenue/expense trend
- View truck rankings by a selected metric such as revenue, margin, margin percentage, trip count, or expenses, if approved and available.
- Change the ranking metric.
- View period-based revenue and expense trends.
- Open the related truck or profitability view, where supported.

**Access:** President / Management: view. Operations: truck/operations data, with financial metric scope TBD. Finance: financial review, TBD. HR: no routine access. System Administrator: no default financial access.

### 4.1.5 Quick actions
Candidate shortcuts in the prototype:
- Open a new delivery form.
- Upload a POD to an existing delivery.
- Open Reports.
- Start a new company-expense transaction, if the user has Finance transaction permissions.

Quick actions must obey the same permissions as the destination module.

---

## 4.2 Delivery Management

**Purpose:** Maintain completed delivery transaction records after the real-world delivery has occurred. RouteX is not a live dispatch or GPS-tracking system.

### 4.2.1 Delivery register
- **Add:** Create a completed-delivery transaction record.
- **View:** Open the delivery list and an individual delivery record.
- **Edit:** Update allowed delivery fields when authorized.
- **Search:** Search by delivery ID and supported client, truck, driver, or route fields.
- **Filter:** Filter by date range, status, truck, client, and selected search fields.
- **Sort/paginate:** Sort supported columns and page through results where provided.
- **Delete/correct:** Do not hard-delete a saved delivery. Use a permission-controlled void/correction process with a reason and audit trail. Keep the original record and its history; clearly mark voided records and exclude them from active totals as defined by the calculation rules.
- **Validate:** Check required fields, valid linked records, date/time formats, and numeric values.

**Access:** Operations: manage. President / Management: view. Finance: limited view of fields needed for financial review, details TBD. HR: limited crew-reference access only if required, TBD. System Administrator: no routine edit access; technical access is TBD.

### 4.2.2 Delivery details and assignments
A delivery record may include:
- Unique delivery ID
- Client
- Truck / plate number and truck type/reference
- Assigned driver and one or two helpers, where applicable
- Route or delivery locations
- Delivery date
- Delivery status, if the final process requires it
- Remarks
- POD linkage
- Revenue/charges and delivery-attributable expenses

Operations can:
- Select existing client, truck, driver, and helper records.
- Update assignments before or after saving, subject to approved edit rules.
- View the linked truck and crew profiles.
- Correct mistakes where permitted, with an audit trail for important changes.

**Access:** Operations: manage. President / Management: view. Finance: relevant view only, TBD. HR: maintain employee information separately and provide valid crew records; cannot change delivery assignments unless approved. System Administrator: no routine operational edit rights.

### 4.2.3 Delivery timing fields
Candidate timing fields from client discussions:
- Call Time
- ETA / arrival at store
- Start Loading
- End Loading
- Departure

Operations can enter or edit timing values where authorized and view them in the delivery record. Exact definitions, mandatory fields, validation relationships, and use in fee calculations remain **TBD**.

The prototype contains a timeline-style delivery view and sample status progression. Do not interpret prototype-generated timeline entries as actual recorded events or live tracking.

**Access:** Operations: manage. President / Management: view. Other roles: only if operationally necessary and approved.

### 4.2.4 Delivery status
The prototype demonstrates statuses including Pending, In Transit, Delivered, Delayed, and Cancelled, plus a Missing POD filter. However, project documents state that Operations records deliveries after completion.

- View status if included in the final workflow.
- Filter and search by approved status values.
- Change status only according to the client-approved post-delivery workflow.
- Treat cancellation, correction, dispute, or duplicate handling as a controlled action with a traceable reason if approved.

**Confirmed:** RouteX records completed deliveries only. Do not use Pending, In Transit, Delayed, or other in-progress statuses as delivery statuses in the current workflow. If correction or cancellation states are needed for historical records, define them under the record-correction policy.

**Access:** Operations: manage only after the workflow is confirmed. President / Management: view. Other roles: permitted view only.

### 4.2.5 Delivery revenue and additional charges
- Add and edit the base revenue amount.
- Record approved additional revenue charges as separately identifiable entries where necessary.
- View the revenue total and its source entries.
- Correct an erroneous charge only under approved permissions and preserve an audit trail.
- Do not directly edit a calculated margin as though it were a source amount.

The previously discussed ₱500/hour example is **not a fixed rate** and must not be hard-coded as a universal charge. Additional-hour charges and additional-drop fees must follow RRLI-approved variable rules. The exact rate source, trigger, rounding rule, included drop count, and revenue/cost classification must be documented before automating calculations.

**Access:** Operations and Finance: view and edit delivery financial entries under the current provisional approval. President: view. HR: no routine access. Corporate Secretary: TBD. Admin: no default financial-edit access.

### 4.2.6 Delivery expenses
Candidate labels appearing in project documents include Fuel, Labor, Toll, Other, Permits, Entry Fees, Overtime, Demurrage, and Additional Drops. This list is not a final approved category list; some entries might be charges or expenses depending on context.

Operations can:
- Add a delivery-attributable expense.
- Edit a permitted expense entry.
- View expense amounts, categories, descriptions, and related delivery.
- Search or filter delivery records using available expense information.
- Correct a misclassified record through an approved edit/void/reversal action.
- View the calculated delivery result after applying the approved rules.

**Delete/correct:** Do not hard-delete delivery expense entries. Use a controlled void/reversal or correction that preserves the original value and audit history. Voided entries must no longer affect current totals, while remaining visible in history.

**Access:** Operations and Finance: view and edit delivery financial entries under the current provisional approval. President: view. HR: no routine expense editing. Corporate Secretary: TBD. Admin: no default financial-edit access.

### 4.2.7 Delivery history and record corrections
- View the delivery's saved data and linked records.
- View important changes or activity events where audit history is enabled.
- Correct an erroneous record when the user's permissions allow it.
- Require a reason for voids/reversals and material financial or operational corrections.
- Preserve prior values and the change history when a record is corrected or reference information changes.
- Keep voided records visible in history, clearly labelled, and excluded from active calculations as applicable.
- Record who performed the action, when it occurred, what changed, the reason, and before/after values where applicable.

**Access:** Operations and Finance: perform permitted delivery/financial corrections within their approved access. President: view history and corrections. HR: corrections only within its assigned compensation/employee data area. Corporate Secretary: TBD. Admin: administer accounts and authorized audit access, but no automatic financial-edit authority. All void/reversal actions must be permission-checked and logged.

---

## 4.3 Fleet Management

**Purpose:** Maintain truck records and provide a truck profile with delivery history and permitted financial summaries.

### 4.3.1 Truck registry
- **Add:** Register a truck.
- **View:** List trucks and open a truck profile.
- **Edit:** Change plate/reference, truck type, ownership category, status, or other approved fields.
- **Search:** Search by plate number or other approved truck identifiers.
- **Filter:** Filter by active/inactive status and ownership type (owned/subcontracted).
- **Group:** Separate owned and subcontracted trucks in the list if this layout is retained.
- **Delete/deactivate:** Do not permanently delete a truck that is referenced by historical deliveries. Deactivate it when it should no longer be used, preserving its delivery links and history. Archive is optional only if supported by the approved implementation.

Candidate fields:
- Plate number / truck identifier
- Truck type, including 4-wheeler or 6-wheeler
- Ownership category: owned or subcontracted
- Active/inactive status
- Subcontractor association, where applicable
- Photo or supporting reference, if retained

The estimated number of trucks is operational context, not a system-imposed maximum.

**Access:** Operations: manage, subject to final approval. President / Management: view. Finance: view cost-relevant truck context as approved. HR: view limited assignment information if needed. System Administrator: no routine truck-data editing.

### 4.3.2 Truck profile
- View truck details and status.
- View linked delivery history.
- Filter history and financial summaries by reporting period.
- Open an associated delivery.
- View revenue, expenses, result, margin, and trip count only where financial rules and permissions allow these metrics.
- Edit truck master data through a controlled edit action, not from a calculated summary.

**Access:** Operations: view/manage truck details. President / Management: view. Finance: relevant financial information, TBD. HR: limited crew/assignment data, TBD. System Administrator: no default financial edit access.

### 4.3.3 Ownership and subcontractor information
- Mark a truck as owned or subcontracted.
- Associate subcontracted units with a subcontractor record, if the final schema includes it.
- Edit the association when authorized.
- Filter or group truck records by ownership.
- View delivery assignments by truck.

**Status:** Exact subcontractor fields, payment treatment, and whether a dedicated subcontractor-management submodule is required need confirmation.

**Access:** Operations: manage core fleet assignment information. Finance: view payment-related fields only if approved. President / Management: view. Other roles: limited/TBD.

### 4.3.4 Fleet history and profitability
- View a selected truck's delivery history for a chosen period.
- Review approved truck-level results.
- Sort or rank trucks by revenue, expenses, result, margin percentage, or trip count if those metrics are approved and available.
- Drill down from a truck's result to included deliveries and their source records.
- Do not automatically allocate company overhead to truck margins without an approved allocation method.

**Access:** President / Management: view. Operations: operational history, with financial scope TBD. Finance: financial review, TBD. HR: no routine access. System Administrator: no default financial access.

---

## 4.4 Delivery Financials and Company Transactions

The project scope distinguishes **costs assigned to a specific delivery** from **company expenses that are not directly attributable to a delivery**. These must remain separately identifiable.

### 4.4.1 Company expense / transaction register
- **Add:** Record a company expense not directly assigned to a specific delivery.
- **View:** View transaction details and list entries.
- **Edit:** Update date, category, description, amount, remarks, or supporting attachment under approved permissions.
- **Search:** Search by transaction identifier, description, category, date, or other supported fields.
- **Filter:** Filter by date range, category, amount range, or other available fields.
- **Sort/paginate:** Order transaction lists and move through results.
- **Attachments:** Attach or retrieve supporting receipts/documents if the feature is included and configured.
- **Delete/correct:** Do not hard-delete company expenses or compensation/financial records. Use a controlled void/reversal or correction with a reason and audit trail; preserve the original entry and exclude voided entries from active totals as applicable.

Example non-delivery expenses mentioned in project documents include insurance, vehicle registration, office rent, utilities, equipment, office supplies, and other approved operating costs.

**Access:** Finance: manage. President: view. Operations: no routine management access. HR: no routine access except approved reconciliation. Corporate Secretary: TBD. Admin: no default financial-edit access.

### 4.4.2 Expense categories
- View the configured list of categories.
- Select a category when entering an expense.
- Add/edit/deactivate categories only if category maintenance is included in the approved Finance permissions.
- Avoid changing a category in a way that silently rewrites historical reports or classifications.
- Keep company-expense categories distinct from delivery expense categories where required.

Potential examples include Insurance, Registration, Maintenance, Utilities, Rent, Office Supplies, Equipment, and Other. The final category list and who maintains it are **TBD**.

**Access:** Finance: manage, subject to category-maintenance approval. President / Management: view. Other roles: use categories only within permitted forms; no category administration by default.

### 4.4.3 Transaction details and supporting records
- View date, category, amount, description, remarks, creator, and supporting information that the user's role is permitted to see.
- Attach or replace an attachment if supported.
- Correct an incorrect amount/category according to the approved financial correction policy.
- Track important edits through audit history.
- Restrict private documents to authorized users.

**Access:** Finance: manage. President / Management: view. System Administrator: access only as required and approved; administrative status alone does not mean permission to edit financial data.

### 4.4.4 Reconciliation and company-level inclusion
- Distinguish company expenses from delivery expenses.
- Include applicable expense records in company-level reporting under the approved financial model.
- Prevent a single economic expense from being deducted twice because it appears in multiple views.
- Do not allocate overhead to individual trucks/deliveries without a client-approved allocation method.
- Keep calculated totals separate from source entries.

**Access:** Finance: review/manage assigned financial records. President / Management: review aggregate and drill-down results. Operations: view delivery-attributable costs within its access. HR: compensation-related reconciliation only as approved. System Administrator: no default financial editing.

---

## 4.5 HR and Compensation Summaries

**Purpose:** Record or summarize amounts payable to staff, drivers, and helpers for management review. This is not a full payroll-processing system.

### 4.5.1 Employee and crew reference records
- Add an employee/crew record when authorized.
- View and search employee records needed for operational assignment and compensation summaries.
- Edit approved employee/contact/reference fields.
- Mark a person inactive when no longer available for new assignments, if this status is approved.
- Link a driver/helper to a delivery through the delivery assignment feature.
- Avoid exposing compensation data to users who only need a name for assignment.

**Access:** HR: manage employee records if this responsibility is approved. Operations: view/select crew references needed for delivery entry; sensitive HR fields hidden. President / Management: view permitted employee/crew information. Finance: only approved reconciliation fields. System Administrator: account records are separate from employee/crew records; access TBD.

### 4.5.2 Compensation summaries / amounts payable
- Add a compensation amount or period summary under client-approved rules.
- View period, person, amount, and summary details where authorized.
- Edit a summary when permitted and preserve an audit trail.
- Search by employee/driver/helper and period.
- Review compensation summaries for staff, drivers, and helpers.
- Aggregate approved summaries for management review.
- Correct errors through an approved adjustment/void/reversal process if required.

**Not assumed:** Automatic payroll calculations, payslips, attendance, statutory deductions/contributions, tax processing, bank payments, or a full payroll engine.

**Access:** HR: manage compensation summaries. President: view permitted summaries. Finance: view only fields required for approved reconciliation, TBD. Operations: no routine access to compensation amounts. Corporate Secretary: TBD. Admin: no default access to sensitive compensation data.

### 4.5.3 Pay rules and period handling
The project discussions included example daily rates, minimum allowances, trip/payroll splits, cutoffs, and payout dates. Those examples are not approved universal rules.

Before calculating amounts automatically, confirm:
- Rates by person/role and applicable date.
- Allowance and advance treatment.
- How trip-related amounts relate to payroll summaries.
- Cutoff and period definitions.
- How compensation is attributed when a person works on multiple deliveries/trucks.
- How to prevent duplicate cost counting if compensation is already included as a delivery expense.

**Status:** These rules are TBD. RouteX should not silently infer them from examples.

---

## 4.6 Profitability Analysis

**Purpose:** Provide distinct delivery-level, truck-level, and company-level views, with the ability to trace a displayed result back to the records that contribute to it.

### 4.6.1 Delivery-level profitability
- View a selected delivery's recorded revenue, approved costs, result, and margin percentage where the formula is approved.
- Calculate derived values from source entries.
- Open source revenue/charge and expense records.
- Filter results by period and delivery attributes.
- Prevent direct editing of a derived margin as if it were an input amount.
- Handle zero revenue, cancelled deliveries, refunds, adjustments, and disputed records according to approved rules.

**Formula status:** A provisional idea is revenue minus expenses approved as attributable to the delivery. The official formula, margin denominator, rounding, and exceptional cases are TBD.

**Access:** President / Management: view. Operations: view delivery result where permitted. Finance: financial review as approved. HR: no routine access to delivery profitability. System Administrator: no default financial access.

### 4.6.2 Truck-level profitability
- Select a truck and reporting period.
- View linked delivery count/history and approved revenue, expense, result, and margin measures.
- Drill down from truck-level results to the underlying deliveries.
- Review source expense entries when authorized.
- Distinguish owned and subcontracted units if relevant to approved reporting.
- Include truck-specific costs only when the client has defined which costs belong in the metric.
- Do not apply automatic overhead allocation without approval.

**Access:** President / Management: view. Operations: truck history; profitability scope TBD. Finance: financial review as approved. HR: no routine access. System Administrator: no default financial access.

### 4.6.3 Company-level profitability
- View the company result for a chosen reporting period.
- Include applicable delivery revenue/results, non-delivery company expenses, and compensation amounts according to the approved financial model.
- Keep source expenses and compensation summaries identifiable.
- Deduct every underlying expense only once.
- Drill from company totals to truck summaries, deliveries, and source expense records as permissions allow.
- Display the selected reporting period and distinguish revenue, expenses, profit/result, and margin percentage where approved.

**Formula status:** The overall company formula and treatment of company operating expenses, payroll/compensation summaries, subcontractor costs, shared costs, and adjustments need client approval. Until then, results are provisional management figures, not a claim of official accounting output.

**Access:** President / Management: view. Finance: maintain its source expenses and review assigned financial totals. HR: maintain compensation summaries, with only approved compensation impact visible elsewhere. Operations: delivery-level source data. System Administrator: no default financial-edit access.

### 4.6.4 Profitability traceability
- Open the source data supporting a result.
- Navigate from company result to truck, from truck to delivery, and from delivery to associated revenue/expense entries.
- Respect role-level access at every drill-down step.
- Do not expose restricted employee compensation or documents through a link from an otherwise visible report.
- Show an empty state when no records match a selected period instead of implying there was no activity outside that period.

**Status:** This is RouteX's proposed differentiator in the project documents. Confirm its exact depth and scope with RRLI.

---

## 4.7 Search and Record Retrieval

### 4.7.1 Global search
- Search records available to the current user's role.
- Search supported identifiers/text such as delivery ID, truck plate, client, driver/helper, employee, and transaction information.
- Open a matching record if the user is authorized.
- Avoid exposing restricted fields in result snippets.
- Show a useful empty state when there are no matching results.

**Access:** All roles may use search for authorized information. Search scope is role-specific.

### 4.7.2 Module-level search and filters
Candidate filters include:
- **Deliveries:** delivery ID, client, truck, driver, route, date range, approved statuses, POD state.
- **Fleet:** plate, truck type, ownership, active/inactive status.
- **Company expenses:** date range, category, description, amount range, and other approved transaction fields.
- **HR summaries:** employee/person and period, with sensitive details limited by role.
- **Reports:** report type, date period, and supported report filters.

### 4.7.3 Shared date-range control
The prototype shows a shared date selector used by Dashboard, Deliveries, Fleet, Reports, and Transactions.

Candidate presets shown in the prototype:
- All time
- Last 7 days
- Last 30 days
- This month
- Last month
- Custom range

The selected period should remain visible in relevant screens and report output. Exact date-boundary behavior, week definition, persistence, and inclusion rules need confirmation before implementation.

**Access:** All roles can filter data within the modules they may access.

---

## 4.8 Reports and Exports

### 4.8.1 Report selection and preview
Candidate report groups shown in the prototype:
- Revenue
- Expenses
- Profitability
- Operations

Authorized users can select a report category, preview the report, and see the selected period. The final report set and permitted fields should be confirmed with RRLI.

### 4.8.2 Delivery activity report
- View delivery counts by approved status and date range.
- Review delivery list/history and related operational details.
- Include POD state or completeness information only if approved.
- Filter to the selected reporting period.

**Access:** Operations: operational reports. President / Management: view. Finance: only needed fields, TBD. HR: no routine access except authorized crew information.

### 4.8.3 Revenue and delivery-expense reports
- View recorded revenue and approved delivery expense totals.
- Group by supported expense category or other approved dimension.
- Filter by date range and supported delivery attributes.
- Drill down to source deliveries and entries when permitted.

**Access:** President / Management: view. Finance: view/reconcile as approved. Operations: delivery financial data permitted by role. HR: no routine access.

### 4.8.4 Company-expense report
- View company expense totals by period and category.
- Count expense records once.
- Drill down to the company expense register if permitted.
- Apply category/date filters where supported.

**Access:** Finance: manage source records and view reports. President / Management: view. Other roles: no routine access unless approved.

### 4.8.5 Truck profitability report
- List trucks with approved ownership type, trip count, revenue, expenses, result, and margin.
- Filter by reporting period.
- Open truck profile/history.
- Drill into delivery and source records while enforcing permissions.

**Access:** President / Management: view. Operations: operational truck history, financial details TBD. Finance: assigned financial review. HR: no routine access.

### 4.8.6 Company-level summary
- Present delivery results and relevant non-delivery expense/compensation summaries under the approved model.
- Display revenue, expenses, result, and approved margin measures separately.
- Include source-traceability paths where included.
- Do not count an expense twice because it appears in multiple sections.

**Access:** President / Management: view. Finance and HR: see their assigned source data and approved reconciliation views. Operations: delivery source data. System Administrator: no default access to sensitive financial results.

### 4.8.7 Print and export
The prototype includes PDF/print and Excel export actions.
- Preview the selected report.
- Print or export supported report formats.
- Include the reporting period and relevant filters in the output.
- Enforce the same access permissions on exports as on screen views.
- Record sensitive export actions in the activity log if required by the approved audit policy.

**Status:** PDF/Excel are shown in the prototype; final supported formats and export behavior need confirmation. Exporting should not be treated as complete until tested with real source records.

---

## 4.9 User and Access Management

### 4.9.1 User account register
- **Add:** Create a user account with the required identity and role fields.
- **View:** View account details and current status.
- **Edit:** Update approved fields, role assignment, or status.
- **Search:** Find accounts by name, email, role, or status.
- **Deactivate:** Disable access when a user should no longer sign in, if authorized.
- **Delete/deactivate:** Do not hard-delete user accounts tied to audit events. Disable/deactivate access when a user should no longer sign in, preserving the account identity in historical audit records.
- **Validation:** Enforce unique identifiers such as email, valid role assignments, and authentication requirements.

**Access:** System Administrator: manage. President / Management: view only if approved. Other roles: no account-administration access.

### 4.9.2 Role and permission management
- View the approved roles and their assigned capabilities.
- Assign an approved role to a user.
- Change a user's role only with authorization.
- Maintain the permission matrix only if role-definition management is explicitly granted to the administrator.
- Review access changes and log who made them and when.

**Status:** The final organizational role list and detailed permission matrix are TBD. The prototype's role editor/role names should not be assumed to be the final production permissions.

**Access:** System Administrator: manage approved assignments. President / Management: approve or view changes according to the governance process, TBD. Other roles: no access.

### 4.9.3 Separation of duties
- Ensure that a user receives only the permissions needed for the assigned role.
- Keep user administration separate from financial edit rights.
- Restrict HR compensation details to authorized users.
- Restrict POD files and supporting expense documents to authorized users.
- Enforce the permission check on every protected page, query, mutation, and export.

**Access:** System Administrator maintains authorized access settings. Each role accesses only its approved modules/data.

### 4.9.4 Activity logs and audit history
Candidate logged events include:
- Login/access events
- Delivery creation and modification
- POD upload
- Company-expense creation/modification
- User account or role changes
- Report generation/export, if required

Operations:
- View relevant activity records according to role.
- Search/filter audit events if included.
- Review important before/after values for operational and financial changes where supported and approved.
- Do not modify historical audit records through normal business screens.

**Access:** System Administrator: view/manage audit access. President / Management: selected audit views if approved. Other roles: own/relevant events only if the final policy permits. Exact retention and visibility are TBD.

---

## 4.10 Settings and Personal Preferences

### 4.10.1 Appearance
The prototype shows Light, Dark, and System themes.
- Change the current user's appearance preference if this remains in the product.
- This changes presentation only, not data access or permissions.

**Access:** Each authenticated user for their own preference.

### 4.10.2 Password update
The prototype shows a password update form with new-password and confirmation fields.
- Enter a new password.
- Confirm the new password.
- Validate the password policy.
- Show a clear success or validation message.
- Never show or store a password in plain text.

Password-reset administration and exact production password policies need confirmation.

**Access:** Each user may update their own password through the approved authentication flow. System Administrator may initiate administrative account recovery only if approved; this does not mean the administrator can view a user's password.

### 4.10.3 Profile settings
The currently visible prototype flow clearly supports appearance and password settings. Broader profile editing (for example, editing the user's name, email, phone, or profile photo) is not treated as confirmed functionality.

**Status:** Profile editing is **TBD**.

---

## 5. Shared behaviors and cross-module rules

### 5.1 Record validation
- Require fields approved for the relevant record type.
- Validate date/time formats and supported relationships.
- Validate money fields using appropriate decimal-safe storage.
- Reject invalid reference links and unsupported files.
- Do not assume all amounts must be non-negative if refunds, credits, or adjustments are later approved; define explicit rules.

### 5.2 Audit and correction
- Important edits to operational and financial records should identify the user and timestamp.
- Preserve historical financial values when current reference rates change.
- Implement the confirmed preserve-history policy for corrections, duplicates, refunds, voids, and reversals. Define transaction-specific calculation effects and test them before production.
- Do not treat hard deletion as the default.

### 5.3 Financial consistency
- A derived result must be based on source records and approved financial rules.
- Each underlying expense must be counted once in company-level results.
- Do not automatically allocate overhead to truck/delivery margins without an approved method.
- A report showing an expense does not create a new expense.
- HR compensation summaries must not duplicate costs already included in delivery financials unless the approved model explicitly reconciles them.

### 5.4 File protection
- POD and supporting documents must be linked to the appropriate record.
- File access must be permission-checked.
- File-type and size limits, retention, replacement, and deletion rules need approval.
- A filename or link must not expose a private document to an unauthorized user.

### 5.5 Search, filters, and empty states
- Search results must be limited to records the user can access.
- Keep the active reporting period visible on relevant pages and reports.
- If no records match a period/filter, say no records matched that selection. Do not imply there was no activity outside that period.

---

## 6. Explicitly out of scope unless separately approved

These are not part of the documented current scope:
- Live GPS tracking, real-time truck location maps, or telematics.
- Automatic dispatching, route optimization, customer-facing booking, or a customer portal.
- Complete accounting-system replacement, tax/BIR filing, and statutory reporting automation.
- Full payroll processing, attendance management, payslips, statutory payroll computations, or automated bank payments.
- Automatic imports from external platforms or other third-party integrations.
- Automatic allocation of company overhead to trucks/deliveries without an approved allocation rule.
- Inventory management, stock receiving, dispensing, and low-stock alerts. These are not identified as RouteX modules in the current project documents.

A proposed feature should be added to scope only through the team's normal review and approval process.

## 7. Open decisions to resolve before treating this as final

| ID | Decision / status | Remaining action |
|---|---|---|
| ACL-01 | **Confirmed:** Roles are Admin, President, Corporate Secretary, Operations, Finance, and HR. | Define Corporate Secretary's exact module and field permissions. |
| ACL-02 | **Provisionally approved:** Access matrix and role permissions for now. | Test and implement server-side permission checks; settle Corporate Secretary and field-level exceptions. |
| ACL-03 | **Confirmed:** Operations and Finance can edit delivery financial entries. | Apply and test audit logging for financial edits and corrections. |
| ACL-04 | **Confirmed:** Only completed deliveries are recorded. | Keep in-progress statuses out of the delivery workflow; apply the preserve-history correction/void process to erroneous records. |
| ACL-05 | **Confirmed:** Timing fields are not needed. | Exclude Call Time, ETA, loading times, and Departure from required delivery fields and automatic charge calculations. |
| ACL-06 | **Provisionally approved:** Financial rules/formulas for now. | Write precise, testable formula and category rules before implementation; the earlier discussion still contains examples that must not be treated as universal rules. |
| ACL-07 | **Confirmed:** Additional-hour charges are not a fixed rate. | Record the variable rate source, trigger, rounding, and additional-drop calculation before automating fees. |
| ACL-08 | **Provisionally approved:** Compensation rules for now. | Document exact rates, allowances, advances, period rules, and expense de-duplication behavior. |
| ACL-09 | **Confirmed:** Preserve history. | Do not hard-delete historical delivery or financial records; implement controlled correction/void/reversal with reasons and audit trails, and deactivate referenced trucks, employees, and users instead of deleting them. Configure and test role permissions and calculation effects. |
| ACL-10 | **Provisionally approved:** POD/file access and handling for now. | Configure and test file permissions, file limits, replacement/deletion, and retention. |
| ACL-11 | **Provisionally approved:** Report list, permissions, and exports for now. | Confirm final report fields and test role-limited export behavior. |
| ACL-12 | **Confirmed:** Missing-POD/incomplete-record cues are included. | Define exact trigger conditions, display locations, and how users resolve the issue. |
| ACL-13 | **Provisionally approved:** Retention, backup, and audit expectations for now. | Record exact configuration and test backup/restore before turnover. |

## 8. Source alignment and implementation status

This reference is aligned to the RouteX project documents that describe:
- post-delivery transaction entry by Operations;
- owned and subcontracted truck records;
- delivery-attributable expenses and separate company operating expenses;
- HR compensation summaries rather than a complete payroll engine;
- delivery-, truck-, and company-level profitability;
- global search/date filters, reports, role access, and auditability;
- no automatic GPS, dispatch, or route optimization under the current scope.

The available `RtX_-prototype-z(4).html` demonstrates a static interactive prototype with Dashboard, Deliveries, Fleet, Transactions, Reports, Administration, shared date/search controls, PDF/Excel report actions, appearance settings, and sample records. Its displayed role matrix and data are demo content. It does **not** prove production authentication, persistent database behavior, or that the broader HR and company-profitability workflows are fully implemented.

Use this Markdown as the working feature inventory and access-control reference. Confirm the TBD decisions with RRLI and reconcile them with the actual application before treating it as a final build checklist.
