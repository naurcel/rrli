# Scope and Exclusions

## In scope
- Post-delivery records for completed deliveries only.
- Delivery, truck, client, driver/crew, revenue, delivery-expense, and POD records.
- Company operating expenses not directly assigned to a delivery.
- Employee/crew reference information and compensation summaries.
- Search, filtering, record retrieval, reporting, profitability analysis.
- Authentication, role-based access control, administration, activity logs/audit trail.
- Historical corrections and voids that preserve original records and traceability.

## Explicitly out of scope unless formally amended
- Live GPS tracking or tracking-device integration
- Live dispatch and route optimization
- Customer-facing portal
- Full accounting-system replacement or BIR/tax filing
- Full payroll engine, attendance, payslips, automatic bank payments
- Predictive maintenance and inventory management
- Third-party integrations not approved in scope

## Workflow rule
Only completed deliveries are recorded as delivery transactions in the intended production workflow. Prototype statuses such as Pending or In Transit must not be carried into production requirements without explicit approval. Delivery timing fields such as Call Time, ETA/arrival, Start Loading, and End Loading are not required fields in the current confirmed direction and must not drive automated charges.

## Scope changes
The Letter of Agreement requires scope changes to be agreed in writing. See the canonical agreement in [Canonical Documents](../09-References/Canonical-Documents/Agreements/).

> Mirrors: `RouteX_SRS.pdf`, Sections 1.3 and 1.6; `RouteX_LETTER OF AGREEMENT.docx.pdf`, Sections 1.3–1.5. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
