# RRLI Activity Diagrams

These diagrams capture recent workflow decisions. Confirm each action against the actual UI and repository before implementation.

## 1. Record company income or company expense

```mermaid
flowchart TD
    A[Open Company Finance] --> B{Choose record type}
    B -- Income --> C[Enter company income details]
    B -- Expense --> D[Enter company expense details]
    C --> E[Validate record]
    D --> E
    E --> F{Valid and authorized?}
    F -- No --> G[Show validation or permission error]
    G --> C
    F -- Yes --> H[Persist company financial record]
    H --> I[Update income and expense totals]
    I --> J[Recalculate net balance]
    J --> K[Refresh Company Finance and eligible reports]
```

Rules:
- Company Finance contains both Income and Expenses.
- Net balance = total company income - total company expenses.
- Company-level records do not automatically attach to deliveries or trucks.
- Company expenses do not affect truck profitability.

## 2. Record or import a delivery

```mermaid
flowchart TD
    A[Start manual delivery entry or Excel import] --> B[Enter or parse trip fields]
    B --> C{Truck plate exists?}
    C -- Yes --> D[Link existing truck]
    C -- No --> E[Register truck from available import fields]
    E --> F[Leave unavailable fields blank or use approved defaults]
    D --> G[Add Store Drop-offs]
    F --> G
    G --> H[Assign one driver and 1-2 helpers]
    H --> I[Validate duplicate crew and same-date assignment]
    I --> J{Valid?}
    J -- No --> K[Show validation errors]
    K --> H
    J -- Yes --> L[Save delivery]
```

Rules:
- One delivery represents one trip.
- Store Drop-offs are destinations within the delivery.
- Do not create individual stop records beyond the existing Store Drop-off structure.
- Do not duplicate revenue or trip expenses across drop-offs.
- Preserve the existing Operations 3-day entry/edit window and Admin historical-entry rule from 2024-01-01, subject to current repository requirements.

## 3. Resolve unknown trip expenses

```mermaid
flowchart TD
    A[Delivery contains unknown expense] --> B[Show financial incomplete state]
    B --> C[Authorized dispatcher edits delivery]
    C --> D[Resolve each unknown as confirmed amount or not applicable]
    D --> E{Any unknown remains?}
    E -- Yes --> C
    E -- No --> F[Finalize financial state automatically]
    F --> G[Include in eligible delivery/truck aggregates]
```

Company-level expenses are not part of this trip-expense resolution or truck profitability allocation.

## 4. Finance import duplicate review

```mermaid
flowchart TD
    A[Import finance rows] --> B[Identify possible duplicate candidates]
    B --> C[Flag candidates for manual review]
    C --> D{Reviewer decision}
    D -- Combine --> E[Combine only after explicit confirmation]
    D -- Keep separate --> F[Retain separate records]
    D -- Exclude --> G[Exclude selected row]
    E --> H[Persist decision and audit]
    F --> H
    G --> H
```

Never auto-combine possible duplicates.

## 5. Create a custom role

```mermaid
flowchart TD
    A[Authorized Admin or Superadmin opens Role Management] --> B[Enter role name and details]
    B --> C[Choose permissions from actual RRLI permission catalog]
    C --> D[Validate creator authority for every selected permission]
    D --> E{Within authority and not protected capability?}
    E -- No --> F[Reject grant and explain]
    E -- Yes --> G[Save custom role]
    G --> H[Write audit event]
    H --> I[Role becomes available for eligible assignment]
```

Custom roles must not receive permissions beyond the creator's authority. Protected role-management authority is not a freely grantable custom permission.

## 6. Edit role permissions

```mermaid
flowchart TD
    A[Authorized manager selects role] --> B[Load current grants]
    B --> C[Modify permission selection]
    C --> D[Validate hierarchy and protected-role rules]
    D --> E{Valid change?}
    E -- No --> F[Reject change]
    E -- Yes --> G[Save updated grants]
    G --> H[Apply changes immediately]
    H --> I[Audit actor, time, role, action, old/new grants]
```

Admin may edit lower built-in roles and custom roles within authority. Only Superadmin may edit the Admin role.

## 7. Assign or remove roles from a user

```mermaid
flowchart TD
    A[Authorized manager opens user account] --> B[Select one or more assignable roles]
    B --> C[Validate role hierarchy and assignment authority]
    C --> D{Valid assignment?}
    D -- No --> E[Reject and explain]
    D -- Yes --> F[Save role assignments]
    F --> G[Recompute effective permissions]
    G --> H[Audit assignment change]
```

- Users may hold multiple roles.
- Admin cannot assign Admin or Superadmin.
- Only Superadmin can assign Admin.
- Superadmin remains a single protected account held by the President.

## 8. Disable or enable a role

```mermaid
flowchart TD
    A[Authorized manager selects role] --> B[Check protected role and authority]
    B --> C[Check Superadmin continuity]
    C --> D{Would change lock out sole Superadmin?}
    D -- Yes --> E[Reject change]
    D -- No --> F[Set role enabled or disabled]
    F --> G[Recompute effective permissions]
    G --> H[Disabled role contributes no permissions]
    H --> I[Other enabled roles still contribute]
    I --> J[Audit change]
```

## 9. Delete a custom role

```mermaid
flowchart TD
    A[Authorized manager requests custom role deletion] --> B{Role assigned to any user?}
    B -- Yes --> C[Block deletion; unassign or reassign users first]
    B -- No --> D[Validate authority and protected-role rules]
    D --> E[Delete role]
    E --> F[Audit deletion]
```

Built-in roles cannot be deleted.

## 10. Upload a document

```mermaid
flowchart TD
    A[Choose document] --> B[Upload to private storage]
    B --> C[Save document metadata and storage reference]
    C --> D[Associate with Delivery or Store Drop-off]
    D --> E[Display in authorized related view]
```

Use the project's existing storage/backend approach. Do not create separate stop records just to attach documents.
