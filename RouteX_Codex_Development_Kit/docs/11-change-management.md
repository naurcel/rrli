# Change Management for an Evolving Project

## Goal
RouteX will change as users test screens, clarify rules, and refine the design. Changes should be cheap to make and safe to review.

## Before a change
Codex should:
1. Restate the requested outcome briefly.
2. Identify the relevant module, shared components, schema, style tokens, and tests.
3. Inspect current behavior before editing.
4. Determine whether the request changes UI only, business logic, data schema, access policy, or multiple layers.
5. Identify migration/backward-compatibility risks.
6. Ask only the questions that materially block safe implementation.

## Change classification
- **Visual-only**: typography, spacing, colors, layout, component styling. Prefer tokens/shared components.
- **Interaction**: search, filters, forms, sorting, pagination, navigation.
- **Business rule**: formulas, statuses, rate calculations, compensation, eligibility. Requires approved definition.
- **Data/schema**: tables, columns, relations, indexes, migrations. Needs migration and data-safety review.
- **Security/access**: roles, authorization, export access, sensitive fields. Requires explicit policy and server-side tests.
- **Cross-cutting**: affects multiple modules or shared primitives. Identify impacted surfaces before editing.

## Safe implementation loop
1. Create a short impact list.
2. Make the smallest coherent change.
3. Update or add tests.
4. Run focused checks.
5. Inspect adjacent behavior that depends on the changed contract.
6. Update documentation and progress log.
7. Report any deferred items.

## Styling changes
- Global color/spacing/radius/font changes should normally use centralized tokens.
- Shared component behavior should be updated in the component, not patched independently in every screen.
- If a screen needs a legitimate exception, explain why and keep it localized.
- Avoid broad one-off CSS selectors that unintentionally change unrelated pages.
- When changing token names, migrate references and search for leftovers.

## Database changes
- Inspect existing data and constraints before designing a migration.
- Explain forward and rollback considerations.
- Do not run destructive or production migrations without explicit authorization.
- Do not delete historical financial records to simplify a new model.
- If the correct migration depends on an unresolved business rule, pause and ask.

## Scope control
Do not bundle unrelated cleanup into a feature request. Report separate improvement opportunities rather than automatically expanding the task.

## Change request template
Use `templates/change-request-template.md` for larger or cross-cutting requests.
