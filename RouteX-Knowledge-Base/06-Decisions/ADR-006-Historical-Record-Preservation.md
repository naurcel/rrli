# ADR-006: Historical Record Preservation

- **Status:** Confirmed direction; implementation details TBD
- **Sources:** Current feature/access-control specification and user-confirmed project decisions

## Decision
Preserve historical records. Use controlled correction, void, reversal, or archive behavior rather than permanent deletion for operational/financial records. Deactivate trucks/employees and disable users while retaining historical links and audit identity. Voided entries remain visible in history and are excluded from active totals according to approved financial rules.

## Consequences
Audit events should capture actor, timestamp, action, record, reason, and before/after values where applicable. Exact retention period, approval flow, and implementation tests remain unresolved.
