# Development Methodology

The project materials imply a staged workflow from requirements verification through implementation, internal QA, client UAT, fixes, training, deployment, and turnover. The schedule is compressed and must be tracked against actual status rather than assumed completion.

Recommended control loop:
1. Confirm requirement and source of truth.
2. Resolve business rule and acceptance example.
3. Implement server-side data/permission logic.
4. Implement UI against the validated contract.
5. Add unit/integration/authorization tests.
6. Reconcile financial outputs with approved examples.
7. Run UAT and record sign-off/defects.
8. Deploy, verify backup/restore, and hand over documentation.

Scope changes require written agreement under the Letter of Agreement. See [Implementation Roadmap](../04-Development/Implementation-Roadmap.md).
