# Data Flow

1. Authorized staff enter a completed delivery and link the appropriate truck, client, driver/crew, and delivery details.
2. Authorized Operations/Finance users record and correct delivery revenue and expenses under the approved permission matrix.
3. Finance records company operating expenses that are not assigned to a specific delivery.
4. HR records approved compensation summaries for the relevant period.
5. POD files are uploaded and linked to a delivery record.
6. Server-side logic validates entries and applies approved financial rules.
7. Dashboard, truck profile, search, reports, and exports read from the same source records and calculation logic.
8. Significant changes and controlled voids/reversals are recorded in audit history.

No overhead allocation or variable fee formula should be automated until the relevant rule is approved. Exact flows and entity relationships depend on the final schema.
