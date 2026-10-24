# Development Workflow: Inspect → Build All → Audit All → Finish

This workflow is designed for long-running development with Codex in VS Code. It prevents the agent from losing context, polishing one screen while others are missing, or claiming completion without evidence.

## Phase 0: Inspect the live project

Before coding:
1. Inspect the repository root, existing `AGENTS.md` files, README, package manager lockfile, scripts, app routes, component folders, styles, database schema/migrations, auth setup, storage, and tests.
2. Check Git status and current branch. Do not reset, discard, or overwrite existing work.
3. Identify the actual framework, versions, package manager, database provider, authentication approach, UI library, CSS strategy, and deployment assumptions.
4. Map existing routes/screens to the module files in `docs/modules/`.
5. Record what is complete, incomplete, broken, duplicated, or missing.
6. Run available safe checks and record their actual results.
7. Compare the repository with this kit and list conflicts, missing decisions, and risky migrations.
8. Create or update `docs/13-progress-and-handoff.md`.

**Deliverable:** a concise repository audit with evidence, blockers, and a proposed implementation order. Do not start broad implementation until the audit is complete.

## Phase F0: Establish foundations

Do not rebuild foundations if the repository already has sound equivalents. Confirm:
- Project conventions and route structure.
- Reusable application shell.
- Design tokens and shared UI primitives.
- Database and migration conventions.
- Authentication and server-side authorization.
- Validation and error handling.
- Logging/audit conventions.
- Testing and formatting commands.

Record the files and conventions the agent must follow.

## Phase 1: Build all canonical screens before polishing

The goal is broad, coherent coverage. Implement the approved screen set in the order below. A screen can be marked **Built** only when its route, main layout, core interactions, data states, permissions, and loading/empty/error states are present or clearly documented as blocked.

1. Delivery Management
2. Fleet Management and Truck Profiles
3. Delivery Financials and Transactions
4. HR and Compensation Summaries
5. Profitability Analysis
6. Global Search and Record Retrieval
7. Reports and Export/Print
8. User and Access Management, Administration, and Settings
9. Dashboard

For each module:
1. Read the module specification.
2. Inspect existing code and related schema.
3. List requirements and dependencies.
4. Identify unresolved business rules.
5. Implement the smallest complete vertical slice using existing conventions.
6. Reuse shared components and centralized style tokens.
7. Add validation, authorization, and data-state handling.
8. Run focused checks.
9. Update the module checklist and progress log.
10. Leave audit/polish items unchecked until Phase 2.

Avoid duplicating entire screens or hard-coding styles just to move faster. A consistent functional first pass is more valuable than one perfect screen surrounded by missing modules.

## Phase 1 completion gate
Before moving to the full audit:
- Every canonical module has been reviewed.
- Each module is built, explicitly blocked, or marked not applicable with a reason.
- Shared navigation and page layout are consistent.
- No fake production data is used.
- Styling is controlled by shared tokens/components where possible.
- Build status is supported by route/file evidence.
- Phase 1 is not considered complete merely because pages render.

## Phase 2: Audit all modules

Audit every module, not only the most recently edited one.

### Requirements audit
- Compare each implemented behavior against its module specification and approved decisions.
- Mark each requirement Pass, Fail, Blocked, or Not Applicable.
- Record evidence: file, route, test, screenshot, or reproducible steps.

### Data and financial integrity audit
- Check source-of-truth relationships.
- Verify totals, date ranges, rounding, currency display, missing data, and duplicate-cost prevention.
- Confirm delivery costs are not also counted as general company expenses unless a specific approved model explicitly calls for it.
- Check edits, voids, reversals, and historical record preservation.
- Do not validate an unapproved formula as if it were correct.

### Security audit
- Test permissions on server-side actions and routes, not only the UI.
- Test unauthorized direct requests.
- Check ownership/record scoping where applicable.
- Verify exports do not bypass permissions.
- Check input validation and sensitive-data exposure.

### UX/accessibility audit
- Test loading, empty, error, success, and partial-data states.
- Test keyboard navigation, focus visibility, labels, contrast, and responsive layouts.
- Check long tables, filters, pagination, sorting, and search behavior.
- Confirm style consistency and that shared token changes propagate correctly.

### Test and tool audit
- Run available lint, type-check, unit, integration, and build scripts where practical.
- Do not claim a command passed if it was not run.
- Record environment or infrastructure blockers separately from code failures.

### Fix-and-recheck loop
For each failure:
1. Record the failure and severity.
2. Fix the underlying issue without broadening scope.
3. Rerun the relevant test.
4. Recheck adjacent modules that use the same component, schema, or rule.
5. Update the audit record with evidence.

## Phase F3: Finish and hand over
- Resolve or explicitly document remaining blockers.
- Remove accidental debug output and fabricated fixtures from production paths.
- Confirm documentation matches actual behavior.
- Prepare a demo path using authorized data.
- Summarize migrations, environment variables, setup steps, tests, and known risks.
- Update the progress/handoff log.
- Do not deploy, commit, or push without explicit permission.

## Work-session checklist
At the end of every session:
- [ ] Record the goal and outcome.
- [ ] List changed files.
- [ ] Record commands/tests and exact results.
- [ ] List unresolved questions and blockers.
- [ ] State the next smallest safe task.
- [ ] Confirm no unrequested destructive action occurred.
