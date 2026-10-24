# Functional Requirements

## Delivery management
- Create and maintain records for completed deliveries.
- Associate a delivery with relevant truck, driver/crew, client, delivery date/route details, revenue, expenses, and POD.
- Calculate delivery profitability from approved source entries; calculated margin is not directly editable as a source amount.
- Support authorized corrections while preserving prior values and audit history.
- Do not make operational timing fields mandatory or use them to trigger charges under the current confirmed direction.

## Fleet management
- Maintain truck reference records and view their associated delivery history.
- Distinguish owned and subcontracted trucks if the final approved data model retains that distinction.
- Deactivate trucks that should no longer be used rather than deleting trucks referenced by historical records.

## Financial management
- Record expenses attributable to an individual delivery.
- Record company operating expenses not directly associated with a specific delivery.
- Maintain compensation amounts payable/period summaries for employees, drivers, and helpers, subject to approved HR rules.
- Keep delivery-level and company-level profitability distinct.
- Do not automatically allocate overhead unless RRLI approves a specific allocation rule.
- Avoid double counting the same expense in company-level calculations.

## Search and reports
- Search/filter records using delivery ID, truck plate, driver, client, transaction date, and date ranges where available.
- Retrieve historical records.
- Generate printable/exportable delivery, revenue, expense, compensation-summary, and approved profitability reports.

## POD
- Upload and retrieve POD documents linked to an existing delivery.
- Restrict access to authorized users and keep files private.

## Security and administration
- Authenticate users and enforce server-side role permissions.
- Manage user accounts and approved role assignments.
- Log significant activity and preserve audit history.

## Status caveat
These are requirements/intended capabilities, not evidence that the prototype or deployed application already implements them. Detailed acceptance tests are required.

> Mirrors: `RouteX_SRS.pdf`, Sections 1.3–1.5 and 2; `RouteX_LETTER OF AGREEMENT.docx.pdf`, Section 1. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
