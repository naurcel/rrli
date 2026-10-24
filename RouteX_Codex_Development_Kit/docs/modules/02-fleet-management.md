# Module 2: Fleet Management and Truck Profiles

## Purpose
Maintain reliable truck records and connect each truck to its eligible deliveries and profitability details.

## Scope
- Fleet list with search and approved filters.
- Truck profile/details.
- Truck identifiers and attributes from the approved schema.
- Related delivery history.
- Related profitability summaries where the user is authorized.
- Active/inactive or availability fields only if approved.

## Rules
- Do not invent truck attributes, maintenance workflows, or availability rules.
- Do not introduce GPS, predictive maintenance, or dispatch features unless separately approved.
- Preserve historical relationships. If a truck is retired or its details change, historical delivery reporting must remain interpretable.
- Use a stable internal identifier rather than relying on a mutable display name.

## Implementation sequence
1. Inspect existing truck schema and delivery relationships.
2. Confirm required and unique fields.
3. Confirm how inactive/retired trucks should appear in historical views.
4. Implement list, filters, details, and approved create/edit actions.
5. Link delivery history with appropriate pagination.
6. Display approved profitability summaries only when formula and permissions are settled.
7. Add validation, server-side authorization, and state handling.
8. Test historical references and invalid/duplicate identifiers.

## Acceptance checklist
- [ ] Truck records are searchable.
- [ ] Approved identifiers and uniqueness rules are enforced.
- [ ] Historical deliveries remain linked and readable.
- [ ] Inactive/retired behavior follows an approved rule.
- [ ] Profitability uses approved calculations only.
- [ ] Permissions are enforced server-side.
- [ ] Loading, empty, and error states exist.
- [ ] Tests and evidence are recorded.

## Decisions needed
- Canonical truck fields and unique identifier.
- Truck activation/retirement policy.
- Whether any maintenance data is in scope.
- Which roles can create/edit/view sensitive truck data.
