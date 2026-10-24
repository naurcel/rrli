# Access Control and Security

## Principle
Permissions must be explicit, testable, and enforced on the server. Hiding a menu item or disabling a button is only a presentation detail, not a security boundary.

## Known role names
- Admin
- President
- Corporate Secretary
- Operations
- Finance
- HR

The exact permission matrix is not fully settled. These role names do not grant implicit permissions. In particular:
- Admin must not automatically receive financial edit rights unless approved.
- Corporate Secretary permissions require definition.
- Operations and Finance have both been discussed as potential editors of delivery financial entries, but this must be verified against the approved matrix.
- President's read/write scope must be explicitly confirmed.
- HR scope must remain limited to approved compensation-related functions unless broader scope is authorized.

## Permission matrix
Maintain a source-of-truth matrix in this document or in an approved dedicated file. For each role, specify allowed actions per resource:
- View/list.
- Create.
- Edit.
- Submit/complete.
- Approve, if applicable.
- Void/reverse, if applicable.
- Export/print.
- Manage users/settings.

Use explicit allow/deny/undecided states. **Undecided is not permission to grant access.**

| Resource / action | Admin | President | Corporate Secretary | Operations | Finance | HR |
|---|---|---|---|---|---|---|
| View delivery records | Confirm | Confirm | Undecided | Confirm | Confirm | Confirm |
| Create/edit operational delivery details | Confirm | Undecided | Undecided | Confirm | Undecided | Deny unless approved |
| Create/edit delivery financial entries | Confirm | Undecided | Undecided | Provisional, confirm | Provisional, confirm | Deny unless approved |
| Manage company-level expenses | Confirm | Undecided | Undecided | Deny unless approved | Confirm | Deny unless approved |
| View compensation summaries | Confirm | Confirm/confirm scope | Undecided | Undecided | Undecided | Confirm |
| Edit compensation summaries | Confirm | Undecided | Undecided | Deny unless approved | Undecided | Confirm |
| View profitability analysis | Confirm | Confirm | Undecided | Undecided | Confirm/confirm scope | Undecided |
| Export reports | Confirm | Confirm/confirm scope | Undecided | Undecided | Confirm/confirm scope | Undecided |
| Manage users and roles | Confirm | Undecided | Undecided | Deny unless approved | Deny unless approved | Deny unless approved |
| Change system settings | Confirm | Undecided | Undecided | Deny unless approved | Deny unless approved | Deny unless approved |

This is a decision-tracking table, not an approved access policy. Replace every `Confirm`, `Provisional`, and `Undecided` cell with an approved permission before relying on it in production. Do not code ambiguous cells as allowed.

## Required enforcement
- Enforce access in server actions, route handlers, API endpoints, and server-side data queries.
- Re-check authorization for each sensitive write.
- Validate input on the server even if the client validates it.
- Scope record access where users should only see certain data.
- Prevent exports from leaking data that the user cannot view.
- Do not expose secrets in client bundles, logs, error messages, or documentation.
- Do not store secret values in the Markdown kit. Document variable names only.
- Use safe file-upload validation and storage access policies if uploads are in scope.
- Avoid logging unnecessary personal or sensitive data.

## Security tests
For each protected resource, test:
1. Authorized user can perform the approved action.
2. Unauthorized user cannot perform the action through the UI.
3. Unauthorized user cannot perform it by calling the server endpoint/action directly.
4. A user cannot access a record outside their permitted scope.
5. Export/report paths enforce the same permission rules.
6. Validation rejects malformed or disallowed values.
7. Failed operations do not partially corrupt related records.

## Account and audit administration
Confirm the policy for account creation, deactivation, role changes, password resets, session expiry, and privileged access. Record role changes and sensitive financial edits where required by approved policy.
