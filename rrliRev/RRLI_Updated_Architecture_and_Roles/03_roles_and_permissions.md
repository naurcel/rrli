# RRLI Roles, Permissions, and Role Creation

## 1. Role hierarchy

Built-in roles:

1. Superadmin
2. Admin
3. Operations
4. Finance
5. HR
6. Secretary
7. Customer Representative

The role list's visual order defines the meaning of “lower role”: a role displayed below Admin/Superadmin is lower in the hierarchy.

## 2. Superadmin

- Exactly one Superadmin account exists.
- The President holds this account.
- Superadmin is protected from ordinary editing or deletion through Role Management.
- Superadmin can manage the Admin role and all lower roles.
- Only Superadmin can assign the Admin role.
- Prevent any change that could lock out or remove the sole Superadmin.
- The system must preserve Superadmin continuity during role edits, assignments, disabling, or permission changes.

## 3. Admin

- Admin has broad access as defined by its configured permissions.
- Admin cannot assign Admin or Superadmin.
- Admin can assign roles below Admin.
- Admin can manage permissions for lower built-in roles and custom roles, within its authority.
- Admin can create, edit, enable, disable, and delete custom roles, subject to the rules below.
- Admin retains the protected role-management capability even if Superadmin customizes other Admin permissions.
- Only Superadmin can edit the Admin role itself.

## 4. Built-in roles

- Built-in roles cannot be deleted.
- Their permissions may be customized by authorized Admin/Superadmin.
- Admin's permissions can only be edited by Superadmin.
- Role assignment must respect the hierarchy.
- A built-in role can be disabled only if permitted by the protected-role and Superadmin-continuity rules. Superadmin must remain active and protected.

## 5. Custom roles

Authorized Admin or Superadmin may create custom roles.

A custom role should have:
- Name
- Optional description
- Permission grants
- Enabled/disabled state
- Creator and timestamps

Rules:
- Creator can grant only permissions within their own authority.
- Admin-created roles cannot exceed Admin's authority.
- Superadmin may manage custom roles and permissions across the hierarchy.
- Custom roles cannot be granted protected role-management authority through an ordinary permission checkbox.
- Custom roles may be edited, enabled, disabled, or deleted according to manager authority.
- A custom role assigned to any user cannot be deleted until it is unassigned or users are reassigned.
- Disabled custom roles contribute no permissions.

## 6. Multiple roles and effective permissions

A user may have multiple assigned roles.

Effective permissions are additive:

`Effective permissions = union of permissions from all enabled assigned roles`

Consequences:
- A permission granted by one enabled role remains available even if another role does not grant it.
- A disabled role contributes no permissions.
- Removing or disabling one role does not remove permissions supplied by another enabled role.
- Recalculate effective permissions immediately after role assignment, removal, enable/disable, or permission changes.

## 7. Permission model

Permissions are module/action-based. Do not add record-level, client-level, department-level, or ownership scopes unless the project requirements explicitly change.

Use the actual current RRLI modules and actions as the source of truth. Possible action patterns, only where supported by the existing module, include:

- `view`
- `create`
- `edit`
- `delete`
- `import`
- `export`
- `finalize`
- `assign_crew`
- `upload`
- `replace`
- `verify`
- `review`

Do not create a permission key for a feature that does not exist. Avoid duplicating permission systems or inconsistent action names.

### Company Finance permissions

Company Finance includes:
- Company Income
- Company Expenses
- Financial Summary

The permission model should distinguish the necessary actions for the module, using existing permission conventions. Finance may create/edit/delete company income and expenses according to its grants. Operations remains view-only in Company Finance.

Company Finance permissions must not grant access to delivery revenue or trip expense editing unless separately granted through the relevant operational permissions.

## 8. Baseline role expectations

These are the discussed baseline expectations, subject to the current approved permission configuration:

| Capability | Superadmin | Admin | Operations | Finance | HR | Secretary | Customer Representative |
|---|---|---|---|---|---|---|
| Company Finance | Full | Broad/full | View only | Manage income and expenses as granted | View only | View only | View only |
| Operational modules | Manage all within system | Broad/full | Operational work within assigned permissions | View-only baseline | View-only baseline | View-only baseline | View-only baseline |
| Role management | Protected full authority | Manage lower roles/custom roles | No | No | No | No | No |

The table is a baseline description, not a substitute for the actual permission catalog.

## 9. Role and permission audit

Audit important role-management actions, including:
- Role created, edited, enabled, disabled, or deleted
- Permission grants added or removed
- Role assigned or removed from a user
- Actor and timestamp
- Affected role/user
- Old and new permission values where applicable

Permission changes take effect immediately.

## 10. Protected role-management capability

Role Management is a protected administrative capability.

- Do not expose it as an ordinary permission that a custom role can grant to itself.
- Do not allow managers to grant roles or permissions above their authority.
- Admin must retain role-management access.
- Superadmin must remain the sole protected Superadmin account.
- Validate these rules server-side when backend authorization is implemented.

## 11. Implementation and diagram notes

- Keep UI permission checks and backend authorization consistent.
- UI hiding alone is not security.
- If a backend exists, enforce grants server-side and in database policies as appropriate.
- If using Supabase, follow the project's existing RLS and migration conventions.
- Treat this document as the current agreed model; inspect the actual RRLI permission inventory before implementing keys.
