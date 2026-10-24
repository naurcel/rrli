# Authorization and Data Integrity Tests

Test every role against view, create, update, void/reverse, export, and file access operations where relevant. Test through both UI and direct server requests.

Critical cases:
- Admin role alone does not authorize financial edits.
- Operations and Finance may edit delivery financial entries within the approved matrix.
- Finance manages company expenses as approved.
- HR compensation details are not visible to unauthorized roles.
- Corporate Secretary has no inferred access beyond explicitly approved permissions.
- Disabled user access is blocked and history is retained.
- Deactivated trucks/employees continue to resolve in historical records.
- Corrections and voids require permission and reason and create before/after audit entries.
- Private POD storage cannot be bypassed with guessed IDs/object paths.
- Exports and search endpoints apply the same row/field restrictions as the UI.
