# Implementation Roadmap

1. **Source and rule freeze:** reconcile requirements, confirm open financial rules, access matrix, and acceptance examples.
2. **Technical spike:** validate Auth.js + Supabase integration, server-side role checks, database access, and private storage access.
3. **Data foundation:** finalize ERD/schema, migrations, reference entities, and audit event model.
4. **Core records:** completed deliveries, truck/client/crew references, delivery financial entries, company expenses, compensation summaries, POD.
5. **Financial engine:** implement only approved formulas with test fixtures and reconciliation.
6. **Search and reports:** use shared data-access and calculation paths; enforce authorization for exports.
7. **Administration and audit:** roles, account deactivation, correction/void workflows, and audit visibility.
8. **QA and UAT:** functional, financial reconciliation, access-control, storage, backup/restore, and user acceptance tests.
9. **Deployment and turnover:** verify deployment, data export, documentation, training, and acceptance.

The dates are constrained by the project deadline; see [Project Timeline](../00-Project-Core/Project-Timeline-and-Deliverables.md). Reorder only with documented rationale and stakeholder agreement.

## Frontend execution method

Execute screen/component work using [Frontend Loop Engineering](Frontend-Loop-Engineering.md): read the changelog, decisions, and issues once per continuous session; build all screens before beginning the cross-screen countercheck, audit, simulation, and confirmation phase. This changes execution discipline, not the approved roadmap order or scope.
