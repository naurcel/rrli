# Testing and Acceptance

## Purpose
Define what evidence is required before a feature can be called complete.

## Test strategy
Use the testing tools already present in the repository. Do not introduce a new framework solely because this document lists a testing category.

### Unit tests
Use for isolated calculations, formatters, validators, permission helpers, and domain rules where appropriate.

### Integration tests
Use for database operations, server actions/route handlers, validation, transactions, and authorization boundaries where supported.

### End-to-end tests
Use for critical user journeys if the repository has a suitable framework and environment. If not, document the manual verification steps and the reason automation is unavailable.

### Manual UX checks
Check responsive layouts, keyboard use, focus, loading, empty, error, and permission-denied states.

## Minimum test coverage by risk
- Financial formulas: known inputs and expected outputs, boundary cases, missing data, duplicate-cost protection.
- Authorization: allowed and denied actions, including direct server requests.
- Search/filtering: dates, pagination, empty results, special characters, unauthorized records.
- Forms: required fields, invalid values, duplicate identifiers, server-side validation.
- Exports: permission parity, filter parity, total reconciliation, sensitive fields.
- Shared styling: representative data-heavy and form-heavy screens, theme modes if supported.

## Definition of done
A feature is done only when:
- [ ] Requirements are mapped to implemented behavior.
- [ ] No unresolved critical business rule is guessed.
- [ ] Server-side authorization and validation are present.
- [ ] Loading, empty, error, and relevant partial-data states are handled.
- [ ] Relevant automated/manual checks were actually run.
- [ ] No unauthorized schema/data/destructive action occurred.
- [ ] Visual behavior follows the shared design system.
- [ ] Documentation and progress log are updated.
- [ ] Known limitations are stated clearly.

## Status vocabulary
- **Pass**: verified with evidence.
- **Fail**: tested and does not meet the requirement.
- **Blocked**: cannot verify or implement due to missing decision/dependency/environment.
- **Not applicable**: requirement does not apply, with reason.
- **Not tested**: not yet verified. Do not treat as Pass.

## Test report template
```md
### Check: [name]
- Requirement:
- Command or steps:
- Environment:
- Result: Pass / Fail / Blocked / Not tested
- Evidence:
- Follow-up:
```

## Final task report
At the end of a task, provide:
1. Summary of behavior changed.
2. Files changed.
3. Commands run and exact outcomes.
4. Tests not run and why.
5. Remaining risks and decisions.
6. Suggested next task.
