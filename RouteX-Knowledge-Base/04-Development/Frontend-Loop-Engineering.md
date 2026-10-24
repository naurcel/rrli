# Frontend Loop Engineering — Build Everything, Then Cross-Check & Audit Everything

## 1. Introduction

Keep this manual open while implementing RouteX frontend screens. The **what to build** source is the [Screen Inventory](../03-Design/Screen-Inventory.md), read together with the [Feature and Module Catalog](../01-Requirements/Feature-and-Module-Catalog.md), the relevant screen note under `03-Design/Screens/`, the applicable functional requirements, and the [Implementation Roadmap](Implementation-Roadmap.md). This manual defines **how to build, resume, cross-check, and audit** the frontend without losing progress between sessions.

**Scope:** frontend only. It covers Phase 0 source review, Phase 1 construction of all screens and shared UI foundations, Phase 2 cross-check/audit/simulation/confirmation across every screen, and Phase F3 polish/demo preparation. Server behavior, schema, calculations, authentication, and authorization are dependencies to represent correctly in the UI, not permission to invent backend behavior.

**Sequencing:** complete the Build box for every checklist screen before beginning any Phase 2 audit. Then cross-check and audit the screens in the same order, following complete flows. This avoids paying for a full audit cycle after each individual screen and reduces repeated context switching.

**Accepted trade-off:** a mistaken shared pattern or token in an early screen may be copied by later screens before the audit catches it. That risk is accepted to make end-to-end flow review possible after all related screens exist. A real RouteX example flow is **completed delivery → delivery detail and POD → truck profile/history → profitability analysis/report**. The financial rules and final access matrix still contain unresolved items, so do not present proposed flow behavior as approved business logic.

## 2. Phase 0 — Read what's changed, before building anything

Do this once per continuous work session, not once per screen. Read in this order:

1. **Changelog in full:** read [`08-Logs/Changelog.md`](../08-Logs/Changelog.md). It records knowledge-base changes, not application implementation progress. The available package does not contain live Git history; before using this manual in the actual application repository, inspect the current working tree and recent commits on every available branch. Do not treat the archive timestamp as proof of the live repository state.
2. **Decisions and architecture:** read [`06-Decisions/README.md`](../06-Decisions/README.md), all applicable ADRs, [`02-Architecture/Architecture-Overview.md`](../02-Architecture/Architecture-Overview.md), [`02-Architecture/Data-Entities-and-Relationships.md`](../02-Architecture/Data-Entities-and-Relationships.md), and [`02-Architecture/Tech-Stack.md`](../02-Architecture/Tech-Stack.md). Do not contradict a decision. If a decision appears to need reversal, stop and ask for approval.
3. **Cross-screen issues:** read [`08-Logs/Issues-and-TODOs.md`](../08-Logs/Issues-and-TODOs.md), especially KB-001 through KB-006 (financial rules and access), KB-010/011 (POD and reports), KB-018 (design source reconciliation), KB-024 (implementation evidence), and KB-025 (source coverage). Do not close or silently bypass blockers.
4. **Cross-cutting rules:** use [`07-AI-Agents/Agent-Operating-Rules.md`](../07-AI-Agents/Agent-Operating-Rules.md), [`07-AI-Agents/Source-Authority-and-Conflict-Handling.md`](../07-AI-Agents/Source-Authority-and-Conflict-Handling.md), [`03-Design/Design-Tokens-and-Typography.md`](../03-Design/Design-Tokens-and-Typography.md), [`03-Design/Color-Surface-and-Status-Rules.md`](../03-Design/Color-Surface-and-Status-Rules.md), [`03-Design/Component-Patterns.md`](../03-Design/Component-Patterns.md), [`03-Design/Layout-Responsive-and-Accessibility.md`](../03-Design/Layout-Responsive-and-Accessibility.md), [`01-Requirements/Roles-and-Permissions.md`](../01-Requirements/Roles-and-Permissions.md), [`01-Requirements/POD-and-Document-Handling.md`](../01-Requirements/POD-and-Document-Handling.md), [`04-Development/Coding-and-Repository-Conventions.md`](Coding-and-Repository-Conventions.md), and the current implementation's actual tests and conventions. If the repository adds or changes a rule, update this source list instead of letting it go stale.
5. Only after these reads, begin Phase 1.

**Model and tool economy:** if the environment supports model selection, use a stronger model for Phase 0, the shared foundation, and ambiguous cross-screen decisions; use a cheaper model for repetitive screens that follow established patterns. Prefer deterministic evidence (typecheck, linter, unit/integration tests, accessibility checks, browser automation) over an AI-only review whenever available.

## 3. Phase 1 — Build (every screen)

For each checklist row, in order:

1. **Read:** read only the relevant requirements for that item: its screen inventory entry, its specific screen note, required design-system rules, the relevant decisions/issues, and its matching prototype/mockup if one exists. A mockup is evidence of layout intent, not a substitute for written requirements or an approved business rule. Follow shared/repeated component conventions from `03-Design/Component-Patterns.md` and the actual repository.
2. **Build:** implement the screen/component and its required states using the project's established architecture. Keep unresolved business rules unresolved; use explicit safe placeholders or disabled states where needed and record the dependency rather than fabricating behavior.
3. **Log + check off (Build):** tick Build only when the code exists. In `Build note`, record the route/file evidence, what was built, and the exact next step if work stops now. Add a detailed session log at a natural stopping point; several related screens may share one session entry.

**Do not countercheck, audit, simulate, or confirm in Phase 1.** Do not start Phase 2 until every screen Build box is ticked. **Order matters:** foundation and reference screens come first because later screens reuse their layout, table, form, filter, and dialog patterns.

## 4. Phase 2 — Cross-check and audit (every screen, only after Phase 1 is entirely done)

Do not start until every screen's Build box is ticked. Review each screen in checklist/build order:

1. **Countercheck:** reopen the same requirement and design sources used in Phase 1. Check each documented requirement against concrete implementation evidence. Examples for RouteX: completed-delivery workflows do not expose unapproved in-progress statuses; historical truck references remain available after deactivation; a financial result links back to its contributing source records; and a visible save/export/POD control reaches the intended action. These examples do not approve unresolved formulas or permissions.
2. **Audit:** build the audit list from rules that actually exist in the project's documents. At minimum, check the following only to the extent that the named source defines the rule:
   - Permission-sensitive content/actions and server-enforced authorization: `01-Requirements/Roles-and-Permissions.md`, `07-AI-Agents/Agent-Operating-Rules.md`.
   - Financial traceability and no duplicate expense counting: `06-Decisions/ADR-005-Financial-Traceability.md`, `01-Requirements/Business-Rules-and-Financial-Calculations.md`.
   - Preservation, void/correction behavior, and history: `06-Decisions/ADR-006-Historical-Record-Preservation.md`, `01-Requirements/Data-Validation-and-Lifecycle-Rules.md`.
   - POD privacy/handling: `01-Requirements/POD-and-Document-Handling.md`.
   - Shared table/form/filter/dialog behavior: `03-Design/Component-Patterns.md` and the live repository's component conventions.
   - Interactive hover/focus/disabled/loading/empty/error states, keyboard access, labels, contrast, and responsive behavior: `03-Design/Layout-Responsive-and-Accessibility.md` and `03-Design/Color-Surface-and-Status-Rules.md`.
   - Design tokens and typography: `03-Design/Design-Tokens-and-Typography.md`; trace each color/size to the token source rather than inventing numeric values.
   - Data access and absence of hardcoded production records: `07-AI-Agents/Agent-Operating-Rules.md`, `04-Development/Coding-and-Repository-Conventions.md`.
   - Mockup cross-check: `03-Design/Reference-Screens-and-Assets.md` plus the matching reference artifact.
   - **Retroactive check:** compare this screen's Build/Audit evidence with dated changelog entries. If a relevant rule was added or changed after the box was ticked, re-verify that box.
   - Leave out any category for which the project has no actual rule; do not invent a standard and attribute it to a source.
3. **Simulate:** trace the complete end-to-end flows that involve the screen using project flow documents and acceptance criteria. The architecture's process/activity diagram and [`01-Requirements/Acceptance-Criteria.md`](../01-Requirements/Acceptance-Criteria.md) are starting points. Because the final information architecture and several access/financial rules remain open, any journey derived from the screen list is **proposed, owner to confirm**, not an approved test script. Proposed candidates: (a) find a completed delivery, inspect its detail and POD, (b) follow delivery history from a truck profile, (c) review profitability and trace the figures to source entries, and (d) find a report and export only what the current role may access. Confirm these with the owner before treating them as acceptance flows.
4. **Confirm:** record explicit PASS or FAIL and evidence. Fix every failure and re-check it before ticking Audit. Never tick Audit with a known issue deferred.
5. **Log + check off (Audit):** write a detailed session log with the real timestamp, evidence, tests, known issues, and next steps; tick Audit and fill `Audit note` with evidence and any relevant test identifiers.

## 5. Using the reference mockup image

Reference assets and HTML prototypes exist in `09-References/Canonical-Documents/Design-and-Prototype/`, including `RouteX_Prototype_v4.html`. Use them for layout density, spacing rhythm, and arrangement only. Do not copy colors that conflict with the project's token rules, and do not copy known prototype gaps or treat mock interactions/sample records as production behavior. The repository snapshot does not provide an approved one-to-one mapping between every inventory entry and every mockup view, so uncertain matches are explicitly marked for review.

| Screen in RouteX | Matching screen in mockup/reference | Known corrections required |
|---|---|---|
| Dashboard | Prototype v4 dashboard area, match to be reviewed | Exact metrics and role-based visibility remain TBD; avoid treating mock numbers as live data. |
| Deliveries | Prototype v4 deliveries area, match to be reviewed | Use completed-delivery workflow; remove unapproved Pending/In Transit statuses; timing fields are not required. |
| Delivery detail/edit | Prototype v4 delivery/detail area, match to be reviewed | Confirm required fields and save/correction behavior against current requirements; keep POD and financial history traceable. |
| Fleet | Prototype v4 fleet area, match to be reviewed | Deactivation must preserve historical references. |
| Truck profile | Prototype v4 truck profile/detail area, match to be reviewed | Profitability formula and field access are TBD; don't invent totals. |
| Transactions/company expenses | Prototype v4 transactions area, match to be reviewed | Category taxonomy and financial classifications are not final; no unapproved overhead allocation. |
| Profitability analysis | No approved one-to-one match confirmed | Formula, attribution, and reconciliation behavior require approved rules; build only what is specified. |
| Reports | Prototype v4 reports area, match to be reviewed | Report catalog, fields, export formats, and permissions remain TBD. |
| Administration | Prototype v4 administration area, match to be reviewed | Admin does not automatically receive financial edit rights; Corporate Secretary permissions remain unresolved. |
| HR/compensation | Prototype v4 HR area, match to be reviewed | This is a compensation-summary module, not a full payroll engine; compensation rules remain open. |
| Settings | Prototype v4 settings area, match to be reviewed | Exact settings/profile scope and preference persistence remain TBD. |

**No approved mockup match:** profitability analysis has no confirmed one-to-one screen mapping; shared drawers/dialogs and any route not visibly identifiable in the reference must follow written requirements and be reviewed.

## 6. Checklist

Each inventory screen has two boxes, **Build** and **Audit**, because the phases happen far apart. Every ticked box must have its own resume note; leave notes for unticked boxes blank. **A ticked box is not permanently final.** If the changelog shows a rule, convention, or requirement added/changed after a screen's Build or Audit box was ticked, re-verify that box and record why.

All screen rows below are currently unticked because this workspace contains a knowledge-base archive and prototype files, not the live application repository. Prototype presence alone is not Build evidence. Foundation items are work units and do not count as extra screens in the screen-inventory coverage count.

### Phase F0 — Environment, design foundation, shared components

Blocking decisions to respect: KB-001 to KB-007 (additional-hour/additional-drop rules, profitability and expense attribution, access matrix, and schema), KB-010/011 (POD and report specifications), and KB-018 (final design/navigation reconciliation). These are not to be silently resolved by frontend implementation.

- [x] Build / [ ] Audit — F0.1 Environment and repository conventions (`04-Development/Environment-Setup.md`, `04-Development/Coding-and-Repository-Conventions.md`) — verify actual app structure, scripts, installed versions, route conventions, and test tools before editing.
  - Build note: 2026-10-23, time not available — Confirmed a Next.js 16.4.2 App Router project using `src/app`, TypeScript, Tailwind v4, npm scripts, and no test/lint script. Evidence: `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/page.tsx`. Checks: `cmd /c npm run build` and `cmd /c npx tsc --noEmit` pass. Next step: connect the approved server-side data/auth boundary before presenting preview records as production data.
  - Audit note:
- [ ] Build / [ ] Audit — F0.2 Design tokens and typography (`03-Design/Design-Tokens-and-Typography.md`) — establish approved tokens and Readex Pro handling without inventing numeric values.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — F0.3 Application shell and navigation (`03-Design/Navigation-and-Global-Search.md`) — implement the approved shell and role-aware navigation after information-architecture conflicts are resolved.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — F0.4 Shared UI patterns (`03-Design/Component-Patterns.md`) — implement reusable tables, filters, forms, status treatments, drawers, and dialogs from real conventions.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — F0.5 Data/access integration boundary (`02-Architecture/Architecture-Overview.md`, `07-AI-Agents/Agent-Operating-Rules.md`) — wire frontend to established data/actions and server permission outcomes; do not add a mock data layer as if it were production.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — F0 exit check (Audit phase only) — all blocking UI dependencies are resolved or explicitly represented as nonfunctional/blocked; tokens, shell, shared patterns, data boundary, and permission-aware states have concrete evidence; no invented business rule.
  - Build note:
  - Audit note:

### Phase F1 — Reference/foundational screens (proposed order; audit after all builds)

The current roadmap defines implementation modules but does not declare a frontend screen priority list. The following four are **proposed** because they establish record search, detail, and financial-entry patterns. Owner confirmation is required before treating this as approved priority order.

- [x] Build / [ ] Audit — #1 Deliveries (`03-Design/Screens/Deliveries.md`) — search and manage completed delivery records with approved fields and linked source records.
  - Build note: 2026-10-23, time not available — Implemented the first read-only reference screen at `/` in `src/app/page.tsx`: completed-delivery table, search, POD filter, responsive shell, preview-data notice, missing-POD treatment, empty state, and disabled create/export actions while schema, permissions, POD rules, and data access remain unresolved. Evidence: `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`. Next step: replace the local preview fixture with an authorized server data boundary after KB-006/007/010/012 decisions and validation.
  - Audit note:
- [ ] Build / [ ] Audit — #2 Delivery detail/edit (`03-Design/Screen-Inventory.md`, delivery requirements) — inspect delivery data, financial entries, POD, and history with controlled correction behavior.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #3 Transactions/company expenses (`03-Design/Screens/Transactions-and-Company-Expenses.md`) — record company-level operating expenses using approved categories and source-entry semantics.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #4 Truck profile (`03-Design/Screens/Truck-Profile.md`) — review truck details, delivery history, and only approved profitability data.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — F1 exit check (Audit phase only) — every F1 screen is built; then its requirements, shared patterns, responsive/interactive states, and linked record flow are audited with evidence; no Audit box is ticked before Phase 2.
  - Build note:
  - Audit note:

### Phase F2 — Remaining screens, module by module

- [ ] Build / [ ] Audit — #5 Dashboard (`03-Design/Screens/Dashboard.md`) — show authorized summary and attention items; exact metrics and visibility remain TBD.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #6 Fleet (`03-Design/Screens/Fleet.md`) — search/manage truck records and preserve historical references after deactivation.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #7 Profitability analysis (`01-Requirements/Business-Rules-and-Financial-Calculations.md`) — review delivery/truck/company results only using approved shared calculations and attribution rules.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #8 Reports (`03-Design/Screens/Reports.md`) — generate and export authorized reports after report specifications are confirmed.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #9 Administration (`03-Design/Screens/Administration.md`) — manage users and approved access without granting implicit finance-edit privileges.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #10 HR/compensation (`01-Requirements/Feature-and-Module-Catalog.md`) — manage approved compensation summaries, not full payroll.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — #11 Settings (`03-Design/Screens/Settings.md`) — implement only confirmed personal/system settings and preference behavior.
  - Build note:
  - Audit note:
- [ ] Build / [ ] Audit — F2 exit check (Audit phase only) — all eleven inventory screens appear exactly once in this checklist, all Build boxes are ticked before Phase 2 begins, and each screen passes requirements, rule-based audit, and relevant end-to-end simulation before its Audit box is ticked.
  - Build note:
  - Audit note:

### Phase F3 — Polish and demo preparation

These are polish tasks only when they are in the approved scope; do not expand scope just because a common checklist mentions them.

- [ ] Full responsive sweep across approved breakpoints — check the breakpoints defined in `03-Design/Layout-Responsive-and-Accessibility.md` and record tested widths. Resume note:
- [ ] Keyboard/accessibility sweep — test keyboard navigation, focus visibility, labels, contrast, and interaction semantics against the actual design rules. Resume note:
- [ ] Full-flow simulation — execute owner-approved journeys and acceptance criteria with recorded results. Resume note:
- [ ] Final test evidence — run the available typecheck, lint, tests, and production build; report exact commands and outcomes. Resume note:
- [ ] F3 exit check / demo-ready — every Build and Audit box above is ticked with evidence; every resume note is filled; all required tests have recorded outcomes; no known issue is left unresolved in any session log. Resume note:

### Audit completion record

Add dated entries below. A completion claim later found to be partial is corrected in place by adding an **Audit correction** entry; never delete the earlier claim.

- _No full Phase 2 audit has been performed in the available workspace._

## 7. State of each box

This RouteX knowledge-base archive contains design notes, requirements, and HTML prototype references, but no live application source tree or Git history was available in this workspace. Therefore **all Build and Audit boxes remain unticked**. Do not tick Build based on a prototype or documentation alone. When the live repository is available, tick Build only after locating the screen's actual code and recording the route/file in its Build note. Never pre-tick Audit: it requires the complete Phase 2 countercheck, rule-based audit, simulation, explicit pass/fail, and evidence.
