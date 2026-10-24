# Requirement-to-Test Traceability

| Requirement | Implementation area | Test evidence needed | Blockers |
|---|---|---|---|
| Completed-delivery only | Delivery workflow and validation | Attempt to create non-completed operational record; confirm accepted flow | Final lifecycle values |
| Delivery profitability | Shared calculation module | Approved reconciliation fixtures | Exact formulas/rules |
| No double counting | Company aggregation/report logic | Same expense visible in detail and company result once | Classification and aggregation rules |
| Role access | Server actions/routes/storage | Role-by-operation matrix and direct request tests | Corporate Secretary/field permissions |
| Historical preservation | Corrections/voids/reference deactivation | Audit assertions and historical joins | Exact approval and retention rules |
| POD privacy | Storage and authorized access route | Unauthorized direct access denied | File limits and policy details |
| Search/report/export | Query and export paths | Filter, access, and reconciliation tests | Formats/columns/permissions |
| Backup/restore | Deployment/operations | Restore drill | Schedule and recovery targets |

Update this table as implementation/test IDs become known. Do not invent test IDs.
