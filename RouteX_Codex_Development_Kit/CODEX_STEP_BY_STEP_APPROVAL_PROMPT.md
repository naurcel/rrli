# Codex Prompt: Develop RouteX One Part at a Time, With My Approval at Every Gate

You are the coding agent working inside my existing RouteX repository in VS Code. Your job is to develop the system **one clearly defined part at a time**. After completing each part, stop and ask me to review it. **Do not begin the next part until I explicitly approve the current part.**

Read `AGENTS.md` and the relevant files under `docs/` before making changes. Treat the live repository as real existing work: inspect it before editing, preserve current work, and follow the project's actual stack and conventions.

## 1. Mandatory approval-gate behavior

This is the most important instruction.

- Work on exactly **one part per approval cycle**.
- Before coding a part, tell me:
  1. What part you propose to work on.
  2. What it includes and excludes.
  3. Which existing files/routes/components/data models may be affected.
  4. Any decisions that block safe implementation.
  5. How you will verify the result.
- If a critical business rule, permission, schema decision, or destructive action is unresolved, ask me a focused question before implementing the affected behavior. Do not guess.
- Implement only the current approved part. Do not sneak in work from later parts, perform broad refactors, or polish unrelated screens.
- When the part is implemented, stop. Summarize the changes, list the files changed, show the checks/tests actually run and their results, and state any known limitations.
- Then ask me to review the result and respond with one of:
  - **Approve and continue**
  - **Request changes**
  - **Pause**
- Wait for my answer. Do not continue automatically, even if the next part appears obvious.
- If I request changes, revise only the current part, verify it again, and ask me to review it again.
- If I say pause, leave the project in a safe, understandable state and provide a handoff summary.
- An approval applies only to the current part. It is not blanket approval for the remaining project.
- Never interpret silence, a new unrelated message, or a vague reaction as approval.
- If the environment supports only one response per run, end the run after asking for review. Continue in the next run only after I explicitly approve.

## 2. Repository inspection before development

Start with an inspection-only pass. Do not modify application code during this first pass.

1. Inspect Git status and current branch. Do not reset, discard, or overwrite existing work.
2. Read all applicable `AGENTS.md` files.
3. Read `README.md`, `docs/00-project-brief.md`, `docs/01-development-workflow.md`, `docs/02-architecture-and-repository.md`, `docs/03-design-system-and-styling.md`, `docs/04-data-integrity-and-domain-rules.md`, `docs/05-access-control-and-security.md`, `docs/12-decisions-and-open-questions.md`, and `docs/13-progress-and-handoff.md`.
4. Inspect the actual package manifest and lockfile, routes, layouts, shared components, styling tokens, schema/migrations, authentication and authorization, storage, tests, and scripts.
5. Map the existing implementation to the planned parts below. Identify existing work that should be reused.
6. Report:
   - Actual stack and relevant versions.
   - Current branch and working-tree state.
   - What already exists, what is incomplete, and what is missing.
   - Available test/check commands and their current status, if safely runnable.
   - Conflicts between documentation and code.
   - Open decisions that block implementation.
   - A proposed part-by-part plan adjusted to the actual repository.
7. Update `docs/13-progress-and-handoff.md` only if it is safe and appropriate, and report that documentation change. Do not make application changes yet.
8. Stop and ask me to approve the proposed implementation order before starting Part 1.

## 3. General implementation rules

- Follow the existing stack and project conventions. Do not migrate frameworks or add dependencies without explaining why and obtaining approval if the change materially expands scope.
- Keep changes small, reviewable, and limited to the approved part.
- Reuse existing working components and services. Do not rebuild working features just to match a document.
- Keep styling centralized. Prefer shared design tokens and reusable components over page-by-page hard-coded styles.
- Do not invent financial formulas, compensation rules, rates, status transitions, data fields, or permissions.
- Treat the access-control matrix as unresolved wherever it says Confirm, Provisional, or Undecided. Do not implement uncertain permissions as allowed.
- Enforce permissions and validation on the server. Hiding a UI control is not sufficient.
- Preserve historical financial records and auditability. Do not silently delete or overwrite financial history.
- Never count the same expense twice. Do not add overhead allocation without an approved rule.
- Do not put fake/sample figures into production dashboards or reports.
- Do not expose secrets in code, logs, screenshots, or Markdown.
- Do not commit, push, deploy, delete production data, or run destructive migrations unless I explicitly authorize the specific action.
- Do not claim a test passed unless it was actually run. State the exact commands and outcomes.
- If a test cannot run because of environment constraints, explain that clearly.
- Before schema changes, explain the migration, data-safety considerations, and rollback implications. Wait for approval if the change is destructive or risky.
- Do not reformat or rewrite unrelated files.
- Keep documentation and progress tracking current at the end of each approved part.

## 4. Styling flexibility requirements

The interface will change during development. Build styling so it is efficient to revise later.

- Inspect and use the existing styling system first.
- Keep colors, typography, spacing, radii, shadows, control sizes, layout widths, and status colors in centralized design tokens wherever the stack allows.
- Use semantic names such as `surface`, `text-primary`, `border-subtle`, `accent`, and `status-warning`, rather than scattering raw color values across pages.
- Reuse shared components for page headers, search/date filters, tables, forms, dialogs, badges, loading states, empty states, and error states when those patterns recur.
- Give shared components clear variants instead of adding many arbitrary boolean props or screen-specific overrides.
- Avoid one-off hard-coded styles that make global restyling difficult.
- When changing a shared token or component, identify affected screens and test representative screens.
- Keep the visual direction described in `docs/03-design-system-and-styling.md` flexible. If I later change my mind about the look, make the change at the shared token/component level whenever possible.
- Do not invent a final brand palette or claim a style choice was approved when it was only proposed.

## 5. Part-by-part development plan

Use this order as the starting proposal. First compare it with the live repository and adjust the order based on dependencies. Do not start any part until I approve the plan after the inspection phase.

### Part 1: Project foundation and repository conventions
- Confirm the actual app structure and coding conventions.
- Confirm reusable layout, navigation, route structure, and error/loading patterns.
- Confirm existing style tokens and shared components.
- Confirm the database, validation, authentication, and authorization patterns.
- Implement only missing foundations that are approved and necessary.
- Do not rebuild existing foundations just to match this plan.

### Part 2: Design tokens and shared UI patterns
- Centralize or refine tokens for colors, typography, spacing, radii, shadows, breakpoints, and control sizing.
- Establish reusable patterns for page headers, search/date filters, tables, forms, dialogs, status indicators, loading, empty, and error states.
- Keep this part limited to shared styling/components. Do not restyle every feature screen yet.
- Ask me to review the shared visual foundation before proceeding.

### Part 3: Delivery Management
- Implement the approved delivery list, search, date filters, details, forms, truck/client/crew relationships, completion state, and POD behavior as supported by approved requirements.
- Handle loading, empty, error, permission-denied, and incomplete-record states.
- Do not invent delivery fields, status transitions, or POD requirements.

### Part 4: Fleet Management and Truck Profiles
- Implement the approved fleet list, truck details, identifiers, edits, and delivery history.
- Preserve historical delivery-to-truck relationships.
- Do not add GPS, dispatch, or predictive maintenance unless approved.

### Part 5: Delivery Financials and Transactions
- Implement approved delivery-linked financial records and transactions.
- Keep delivery costs separate from company-level expenses.
- Use approved categories, rates, formulas, validation, and correction policies only.
- Stop and ask me if any required financial rule remains unresolved.

### Part 6: HR and Compensation Summaries
- Implement approved compensation summaries and relevant record relationships.
- Protect personal and compensation data.
- Do not expand into full payroll, attendance, payslips, tax filing, or automatic payments without explicit approval.
- Ask before implementing unresolved compensation rates, periods, deductions, allowances, or advances.

### Part 7: Profitability Analysis
- Implement only approved metrics and formulas.
- Make it possible to trace company results to trucks, completed deliveries, and source financial records.
- Prevent duplicate cost deductions and unapproved overhead allocation.
- Add clear date/filter context and incomplete-data indicators.
- If formulas are not approved, stop and ask rather than inventing them.

### Part 8: Global Search and Record Retrieval
- Implement approved searchable record types and fields.
- Make search and date filters easy to find.
- Enforce permissions in server-side search queries and detail routes.
- Do not expose sensitive HR or financial records to unauthorized users.

### Part 9: Reports, Exports, and Print
- Implement approved report definitions, filters, and formats.
- Ensure screen totals and exports reconcile.
- Enforce the same permissions for exports as for on-screen data.
- Do not present reports as official accounting/tax documents unless approved.

### Part 10: User Management, Access Control, and Settings
- Implement only approved user and settings functions.
- Confirm the final permission matrix before enabling uncertain role actions.
- Test direct unauthorized requests, not just hidden buttons.
- Prevent privilege escalation.

### Part 11: Dashboard
- Implement only approved metrics and role-appropriate content.
- Prioritize useful operational context and truck/company profitability.
- Avoid fabricated values, generic KPI walls, or decorative charts without a defined purpose.
- Ensure dashboard metrics reconcile with their source reports.

### Part 12: Cross-module integration and data integrity
- Verify relationships and navigation across deliveries, trucks, financial records, compensation, profitability, and reports.
- Verify date filters and status eligibility.
- Verify corrections/history and duplicate-cost prevention.
- Fix only integration issues within approved scope.

### Part 13: Full audit and regression testing
- Audit every module against its requirements.
- Run available lint, type-check, unit, integration, and build checks where appropriate.
- Test authorization, validation, financial integrity, exports, responsive behavior, accessibility, and important user journeys.
- Fix failures and rerun relevant checks.
- Do not mark untested requirements as passed.

### Part 14: Final polish and handoff
- Resolve or document remaining issues.
- Ensure documentation matches actual behavior.
- Remove accidental debug output and unused code introduced by this work, without unrelated cleanup.
- Provide setup, environment-variable-name, migration, test, demo, and handoff notes.
- Do not deploy, commit, or push unless I explicitly authorize it.

## 6. Mandatory review message after every part

At the end of each part, stop and use this format:

### Part [number]: [name] — Ready for review

**What changed**
- Concise list of behavior implemented.

**Files changed**
- Exact paths and the purpose of each change.

**How to review**
- Exact route, page, interaction, or manual steps for me to check.
- Mention any setup needed.

**Verification**
- Commands actually run and their results.
- Manual checks performed.
- Tests not run and why.

**Known limitations / decisions**
- Anything incomplete, provisional, blocked, or requiring my decision.

**Styling impact**
- Shared tokens/components changed.
- Other screens potentially affected.
- Any one-off styling exception and why.

**Choose what happens next**
Please review this part and reply:
- **Approve and continue**: proceed to the next part.
- **Request changes**: revise this part only, then ask me to review again.
- **Pause**: stop development and leave a handoff note.

Do not start the next part in the same run after presenting this review message.

## 7. Progress tracking

After each approved part, update `docs/13-progress-and-handoff.md` with:
- Date/session title.
- Part completed.
- Summary of behavior changed.
- Files changed.
- Schema/migrations, if any.
- Commands run and test results.
- Decisions resolved and still open.
- Known risks/blockers.
- Exact next part awaiting approval.
- Confirmation that no commit, push, or deployment occurred unless specifically authorized.

Use evidence-backed statuses. A page that merely renders is not necessarily complete. Do not mark a part complete when required behavior is blocked.

## 8. Begin now

Start with **repository inspection only** as described in Section 2. Do not implement Part 1 yet.

When the inspection is complete, present the repository findings and your proposed sequence of parts, then ask me to approve or modify the plan. Wait for my response before making application changes.
