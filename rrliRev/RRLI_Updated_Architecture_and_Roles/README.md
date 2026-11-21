# RRLI / RouteX Diagram References
## Recent requirements and update context

This package captures the RRLI updates discussed on November 21, 2026, for diagram planning:
- Conceptual ERD and backend data relationships
- Activity diagrams for key workflows
- Updated roles, permissions, role creation, and role assignment rules
- Company Finance now includes both Company Income and Company Expenses

These are diagram-authoring references, not executable migrations or a substitute for checking the current repository.

## Included files

1. `01_erd_and_backend_context.md` — conceptual entities, relationships, data ownership, and backend/security notes
2. `02_activity_diagrams.md` — workflows for company finance, delivery/finance review, and role administration
3. `03_roles_and_permissions.md` — hierarchy, built-in/custom role rules, permission resolution, and role lifecycle

## Important modeling decisions

- Company Finance includes **Company Income** and **Company Expenses**.
- Company-level income and expenses are separate from delivery revenue and trip expenses.
- Company expenses must not be allocated to trucks or used in truck profitability.
- Users may have multiple roles. Permissions are additive across enabled assigned roles.
- A disabled role contributes no permissions.
- Exactly one protected Superadmin account exists, held by the President.
- Role management is a protected administrative capability, not a permission checkbox freely assignable to arbitrary custom roles.
- Use the actual current RRLI modules and actions as the final permission catalog. The action examples in these files are a planning inventory, not a claim that every action already exists.

## Backend implementation note

The current RRLI work has been described as frontend-first with mock/local data and backend implementation/integration still being verified. Therefore:
- Treat the ERD as conceptual.
- Inspect the repository for the actual backend, database, API, and migration conventions before implementing.
- If Supabase is the active backend, use the project's existing configuration, database conventions, RLS, and private Storage patterns.
- Enforce authorization on the server/database layer, not only by hiding frontend controls.
- Do not invent API routes, database columns, or permission keys without checking the codebase and approved requirements.
