# Module 6: Global Search and Record Retrieval

## Purpose
Make it fast to find the records users need without forcing them through unnecessary dashboard navigation.

## Design direction
Search is a primary interaction. Date filters should sit close to the search field or page header. Keep results readable and actionable rather than adding decorative analytics.

## Scope
Searchable record types and fields must be approved and reflect the actual schema. Possible record groups include deliveries, trucks, financial transactions, company expenses, and compensation summaries, subject to permission rules.

## Rules
- Search results must enforce the same permissions as direct record views.
- Do not reveal the existence or contents of unauthorized sensitive records.
- Make active filters visible and easy to clear.
- Avoid searching sensitive compensation fields globally unless explicitly approved.
- Define matching behavior rather than promising fuzzy search if only exact/partial matching exists.

## Implementation sequence
1. Inventory searchable entities and fields.
2. Confirm permission-aware search behavior.
3. Confirm query length, matching, sorting, pagination, and date filter semantics.
4. Build a reusable search/filter pattern.
5. Implement server-side queries with safe validation.
6. Link results to authorized detail pages.
7. Add no-results, loading, error, and invalid-query states.
8. Test permission leakage, pagination, filters, and special characters.

## Acceptance checklist
- [ ] Search targets are approved.
- [ ] Results respect authorization.
- [ ] Date filters behave consistently.
- [ ] Filters can be inspected and cleared.
- [ ] Results have useful identifiers and context.
- [ ] Sensitive fields are not exposed unintentionally.
- [ ] Empty/error/loading states exist.
- [ ] Tests and evidence are recorded.

## Decisions needed
- Searchable record types and fields.
- Exact/partial/fuzzy matching behavior.
- Global versus module-scoped search.
- Compensation and other sensitive data inclusion.
- Search result retention/logging, if applicable.
