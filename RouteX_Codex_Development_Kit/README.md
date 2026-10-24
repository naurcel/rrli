# RouteX Development Kit for Codex

A modular, editable Markdown guide for developing **RouteX: Profitability Analysis System** with Codex in VS Code.

This kit is intentionally split into small files. Edit the relevant document as requirements change rather than maintaining one enormous prompt. The files describe the intended workflow and guardrails, not a claim that the current repository already implements them.

## Start here

1. Open the RouteX application repository in VS Code.
2. Copy this folder into the repository root, or merge its Markdown files into the existing project documentation.
3. Read `AGENTS.md` first. Keep it short enough for an agent to follow on every task.
4. Read `docs/00-project-brief.md` and `docs/01-development-workflow.md`.
5. Before coding, have Codex inspect the live repository and report the actual stack, current state, tests, and conflicts with these documents.
6. Resolve the items in `docs/12-decisions-and-open-questions.md` when they block implementation. Do not invent business rules to fill gaps.
7. Use `docs/templates/module-spec-template.md` when adding or changing a module.
8. Track implementation in `docs/13-progress-and-handoff.md`.

## How the kit is organized

- `AGENTS.md`: durable rules for Codex and other coding agents.
- `docs/00-project-brief.md`: product purpose, scope, roles, and non-negotiable principles.
- `docs/01-development-workflow.md`: repository inspection, build-all, audit-all, and handoff workflow.
- `docs/02-architecture-and-repository.md`: architecture expectations and repo-discovery checklist.
- `docs/03-design-system-and-styling.md`: flexible, centralized styling approach.
- `docs/04-data-integrity-and-domain-rules.md`: source-of-truth and financial integrity.
- `docs/05-access-control-and-security.md`: authorization and security expectations.
- `docs/modules/`: individual module requirements.
- `docs/10-testing-and-acceptance.md`: testing and definition of done.
- `docs/11-change-management.md`: how to make future changes safely.
- `docs/12-decisions-and-open-questions.md`: decisions that must not be guessed.
- `docs/13-progress-and-handoff.md`: durable progress tracking.
- `docs/templates/`: reusable templates for module specifications and change requests.

## Important operating rule

These documents are a living specification. If the live repository, approved requirements, or product-owner decisions conflict with a document, stop and report the conflict. Do not silently overwrite working behavior or assume a recommendation is already approved.

## Editing this kit

Prefer small, focused edits:
- Change visual preferences in `docs/03-design-system-and-styling.md`.
- Change a single module in its file under `docs/modules/`.
- Change business formulas and financial rules in `docs/04-data-integrity-and-domain-rules.md` only after approval.
- Record unresolved decisions in `docs/12-decisions-and-open-questions.md`.
- Record progress and exact files changed in `docs/13-progress-and-handoff.md`.

Use relative Markdown links so the kit remains portable.


## Step-by-step development with approval gates

Use [`CODEX_STEP_BY_STEP_APPROVAL_PROMPT.md`](CODEX_STEP_BY_STEP_APPROVAL_PROMPT.md) as the main prompt when you want Codex to develop one part at a time and stop for your review before continuing.
