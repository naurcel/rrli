# RouteX Agent Instructions

## Before making changes
1. Inspect the live repository, existing `AGENTS.md` files, package scripts, routes, schema/migrations, auth setup, component library, tests, and current Git status.
2. Read `docs/00-project-brief.md`, `docs/01-development-workflow.md`, and the specific module/style/security docs relevant to the task.
3. Report the actual stack and relevant existing implementation before proposing edits. Do not assume this kit matches the current repository.
4. Identify existing work and reuse it where suitable. Do not rebuild working features merely to match a document.

## Rules
- Treat approved product requirements and the live repository as the source of truth. Flag conflicts instead of silently resolving them.
- Do not invent financial formulas, compensation policies, permission grants, data fields, or operational rules.
- Keep changes scoped. Ask a focused question if a missing decision blocks safe implementation; otherwise document the assumption as provisional and avoid irreversible behavior.
- Preserve historical records and auditability. Never silently delete, overwrite, or reclassify financial history.
- Enforce authorization on the server for protected reads and writes. Hiding a button is not authorization.
- Keep styling centralized and token-driven. Avoid scattered hard-coded colors, spacing, radii, typography, shadows, and duplicated component styles.
- Do not add a dependency, replace the stack, perform a broad refactor, or introduce an external integration without explaining why and obtaining approval when the change materially expands scope.
- Do not use sample, fake, or fabricated values in production dashboards or reports.
- Do not commit, push, deploy, delete production data, or run destructive migrations unless explicitly authorized.
- Do not claim tests passed unless they were actually run. State commands, results, and limitations.

## Workflow
Follow `docs/01-development-workflow.md`. Work in small, reviewable steps. Keep `docs/13-progress-and-handoff.md` current at the end of each meaningful session.

## Styling
Read `docs/03-design-system-and-styling.md` before visual changes. Theme changes should normally be made in centralized tokens or shared components, not patched screen by screen.

## Completion report
For each task, report:
- What changed and why.
- Files changed.
- Tests/checks actually run and their results.
- Remaining risks, blockers, and unresolved decisions.
- How to continue the task in a fresh Codex session.
