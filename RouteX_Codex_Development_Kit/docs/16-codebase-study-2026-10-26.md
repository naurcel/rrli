# RouteX Codebase Study

**Study date:** 2026-10-26 (Asia/Seoul)  
**Scope:** Read-only architecture, product, workflow, and test study of the live repository.  
**Status:** Evidence report. It does not approve requirements or add application behavior.

## A. Project Overview

RouteX is currently a static Next.js preview of a truck profitability and delivery-operations system for RRLI. The product direction is to trace company performance through trucks, completed deliveries, and source financial records. That traceability is documented as an intended outcome; it is not implemented in the live application.

The verified stack is Next.js **16.4.2** App Router, React **19.3.0**, TypeScript, Tailwind CSS **4**, and npm. There are no installed Supabase, Auth.js/NextAuth, shadcn/ui, Lucide, schema, migration, validation, or database packages. The application currently renders nine static routes: eight user-facing routes plus Next.js's generated not-found route.

The root README and a working-reference README describe an intended Next 15/Supabase/Auth.js/shadcn/Lucide stack. That conflicts with `package.json` and the live source. The live code is authoritative for current implementation; the documents remain useful as proposals only.

## B. Architecture Map

| Area | Verified location | Actual behavior |
| --- | --- | --- |
| Root application | `src/app/layout.tsx` | Loads global CSS and Readex Pro, mounts sidebar state, a visual mouse-shadow component, and a portal-based date picker. It also contains a client-side legacy hash-route guard. |
| Routes | `src/app/page.tsx`, `src/app/{dashboard,fleet,transactions,reports,administration,settings,login}/page.tsx` | Each route renders its own page shell and local preview records. All route pages are Client Components. |
| Shared UI | `src/components/route-x-ui.tsx` | Small icon renderer with normalized SVG navigation glyphs. |
| Shared sidebar state | `src/components/sidebar-state.tsx`, `sidebar-state-model.ts` | Width, collapsed state, pointer drag, keyboard resize targets, and local-storage persistence. This is presentation state only. |
| Global date control | `src/components/global-date-range-picker.tsx` | Portal-mounted, local-only date range picker. It changes its own local range and does not filter pages, update the URL, or call a server. |
| Styling | `src/app/globals.css` | Single global CSS file containing tokens, layouts, effects, responsive styles, animations, login styles, and route-specific overrides. |
| Static assets | `public/branding`, `public/profiles` | Logo, symbol, city image, and Shinryu profile image. |
| Tests | `src/components/sidebar-state-model.test.ts` | Five Node test-runner tests for sidebar-width model behavior only. |

There are no `app/api` routes, route handlers, server actions, ORM/database modules, schemas, migrations, authentication/session modules, storage integrations, server validation helpers, or shared domain types in the repository.

### Data flow that exists today

1. Route components define preview tuples/constants locally.
2. Components render those constants directly.
3. The Deliveries route locally filters its constant records with React state.
4. Sidebar width/collapse is retained in browser `localStorage`.
5. No business record is fetched, mutated, authenticated, authorized, uploaded, or persisted.

## C. Feature Inventory

| Product area | Live status | Evidence |
| --- | --- | --- |
| Sign-in | **UI only** | `/login` prevents form submit and calls `router.push("/dashboard")`; it does not read credentials or create a session. |
| Delivery list/search/POD filter | **Partially implemented, local preview only** | `/` uses `query` and `podFilter` state with `useMemo` against local delivery fixtures. Empty state works locally. |
| Delivery create/edit/detail/status lifecycle | **Missing** | Create/export controls are disabled; record links are hash anchors; no detail route, form, persistence, or history exists. |
| POD upload/storage | **Missing** | POD is a fixture status label only; no file input, storage client, metadata, or policy enforcement exists. |
| Fleet | **UI only / placeholder data** | `/fleet` renders local owned and subcontracted truck fixtures; add/export are disabled; hide/search/filter controls do not alter data. |
| Truck profiles/history | **Missing** | No truck detail route, identifiers beyond display strings, or delivery relation exists. |
| Financial transactions | **UI only / placeholder data** | `/transactions` renders fixed tuples. Search, filters, pagination, export, and creation are not wired. |
| Company expenses / financial corrections | **Missing** | No data model, form, audit history, void/reversal flow, or calculation service exists. |
| HR and compensation | **Missing** | No route, component, data model, or permissions implementation exists. |
| Profitability analysis | **UI only / placeholder figures** | Dashboard and Fleet show local revenue/expense/margin text, not a shared calculation or approved metric source. |
| Global search | **UI only** | Dashboard search field is visual only. Module fields are local at best; only Delivery is wired. |
| Date filtering | **UI only** | Global picker owns local date state only. It does not affect lists, metrics, routes, or reports. |
| Reports / export / print | **UI only** | `/reports` renders local report-definition cards; report actions are disabled and no export service exists. |
| Administration / roles | **UI only** | `/administration` displays static member/role tuples; there is no identity, permission, invitation, or audit implementation. |
| Settings | **UI only** | `/settings` shows fixed values and disabled edits; no setting persistence exists. |
| Dashboard | **UI only / placeholder figures** | `/dashboard` renders fixed summaries and static attention items. No role or date-aware query is present. |
| Responsive/sidebar UI | **Implemented for presentation, not product workflows** | Shared state model, CSS breakpoints, pointer/keyboard resize support on representative routes, and reduced-motion CSS exist. |

## D. Important Code Paths

### Preview sign-in

`src/app/login/page.tsx` maintains only password-visibility state. The form handler calls `preventDefault()` and immediately navigates to `/dashboard`. Email/password values, remember-me, and forgot-password have no implementation. The visible note accurately says authentication is not connected.

### Delivery list and local filtering

`src/app/page.tsx` defines preview deliveries and additional scroll rows. `query` and `podFilter` state feed a `useMemo` filter that searches string values of each local delivery object and matches POD status. The resulting array drives the table and the local empty state. The date picker is not an input to this filter. New delivery and export are disabled; clicking a delivery uses a hash target rather than a details screen.

### Shared sidebar behavior

`src/components/sidebar-state.tsx` owns width/collapse state. It restores and saves presentation preferences in `localStorage`, previews pointer drag width through a CSS custom property, and settles at the automatic-collapse threshold. `sidebar-state-model.ts` holds the pure width functions, with five tests in `sidebar-state-model.test.ts`. This is the only tested application behavior.

### Global date picker

`src/components/global-date-range-picker.tsx` portals a picker into the active route's `.topbar`. It supports month selection, local start/end selection, presets, Escape closing, and focus restoration. Its use of browser-local `Date` values means it is not yet aligned to an approved business timezone. It neither exposes controlled state nor applies a range to any route.

### Other route flows

- `src/app/fleet/page.tsx`: renders fixed truck cards and table tuples. The Hide button has no state handler.
- `src/app/transactions/page.tsx`: renders fixed transaction tuples. Search, filters, pagination, and export have no state or server path.
- `src/app/reports/page.tsx`: renders fixed report metadata and disabled report actions.
- `src/app/administration/page.tsx` and `src/app/settings/page.tsx`: render fixed preview tuples/cards with no mutation path.
- `src/app/dashboard/page.tsx`: renders fixed totals, recent deliveries, and attention counts; it consumes no shared delivery or financial source.

## E. Technical Findings

1. **No trust boundary exists.** There is no authentication, authorization, server data access, validation, API route, server action, or storage policy. Disabled buttons and preview notices are not security controls. This blocks any use of actual operational, financial, compensation, or user data.
2. **Documentation does not match the live stack.** Root `README.md` claims Next 15, Supabase, Auth.js, shadcn/ui, Lucide, Vercel, server actions, and storage; `package.json` contains none of these and verifies Next 16.4.2 instead. This can lead to incompatible implementation choices.
3. **The application has no real domain model.** Only the home page declares a `Delivery` type. Fleet, transactions, reports, roles, and settings use untyped display tuples inside page modules. There are no reusable domain entities or relations.
4. **Business fixtures are duplicated and cannot reconcile.** Dashboard recent-delivery and financial figures, Delivery fixtures, Fleet figures, and Transaction fixtures are independently declared. They cannot prove delivery-to-truck-to-transaction traceability or financial reconciliation.
5. **The route shell is duplicated.** Every operational page repeats sidebar/nav/footer markup and route mapping. `SidebarStateProvider` centralizes state, but markup, accessibility attributes, and navigation rules diverge. For example, keyboard resize attributes appear on Deliveries, Fleet, and Dashboard but not consistently on the remaining pages.
6. **Legacy navigation is fragile.** `src/app/layout.tsx` injects a document-level click handler via `dangerouslySetInnerHTML` to translate selected hash links into routes. Several pages still emit `#overview`, `#administration`, or `#settings` instead of normal route links. This should be retired when the shell is shared; it is a maintainability concern, not evidence of an injection vulnerability in its current static form.
7. **Global CSS has accumulated conflicting overrides.** `globals.css` is the correct central styling entry point, but it contains repeated selectors and route-specific rules in a single file. This makes visual changes harder to reason about and risks order-dependent regressions.
8. **Operational UI states are incomplete.** Delivery has a local empty state. No route has data-loading, server-error, permission-denied, conflict/stale-write, or partial-data states because no data boundary exists. Many controls look interactive but are disabled or inert.
9. **Date semantics are not established.** The Settings preview displays `PHP - Asia/Manila`, but date-range calculation uses browser-local time and has no approved connection to filters. Timezone, period boundaries, currency precision, and rounding remain undecided.
10. **Test coverage is intentionally narrow.** The only tests exercise sidebar mathematics. There is no lint script, route/component test suite, integration suite, browser test configuration, or financial/security test.

## F. Business Logic Gaps

The knowledge base provides confirmed principles, not executable rules: preserve history, distinguish delivery costs from company expenses, do not double-count, do not directly edit calculated margin, and do not automate unapproved overhead or variable fees. The following remain blocking decisions rather than implementation requirements:

- D-002 through D-004: canonical delivery fields/statuses, POD requirements, truck fields and retirement behavior.
- D-005 through D-011: financial categories, rates, additional charges, overhead, HR inputs, correction/void/reversal policy, and approved calculation definitions.
- D-012 through D-018: role matrix, account/session lifecycle, report audiences, dashboard metrics, timezone/currency/rounding, audit retention, and backups.
- D-020: deployment/release process.

The code must not infer profitability from the visible preview strings. In particular, there is no approved formula, eligible-status rule, source relation, or decimal-safe calculation implementation to validate.

## G. Testing Results

| Command | Result |
| --- | --- |
| `cmd /c npm test` | Passed: 5 tests, 0 failures. Covers sidebar saved-state normalization, resize clamping, collapse threshold/settling, and keyboard width targets. |
| `cmd /c npm run typecheck` | Passed. |
| `$env:NODE_OPTIONS='--max-old-space-size=4096'; cmd /c npm run build` | Passed. Next.js generated static routes for `/`, `/_not-found`, `/administration`, `/dashboard`, `/fleet`, `/login`, `/reports`, `/settings`, and `/transactions`. |
| `git diff --check` | Passed. |

Not run: lint (no script configured), browser automation (no configured runner), database/security tests (no implementation), visual responsive checks, external-service tests, and financial reconciliation tests.

## H. Recommended Roadmap

1. **Reconcile project documentation with the live repository.** Correct or clearly label the README's intended stack versus the installed stack. This prevents developers from assuming nonexistent Supabase/Auth.js/shadcn/Lucide conventions.
2. **Approve the first trust-boundary and canonical-data decisions.** Decide database/provider, session/auth approach, storage/POD direction, migration policy, canonical delivery/truck fields, initial roles, and audit/correction needs. These choices block safe data work.
3. **Design a minimal server-owned vertical-slice foundation.** After approval, introduce only the selected persistence/auth/authorization/validation conventions and test approach. Do not connect preview fixtures directly to real data.
4. **Extract and test the shared application shell.** Consolidate repeated sidebar/header/navigation markup, replace hash-route interception with direct links, normalize resize accessibility, and add route-level regression coverage. This is a safe structural task once a test approach is approved.
5. **Build Delivery Management as the first production vertical slice.** Use approved fields/statuses/POD policy to deliver authorized list, detail, create/edit, validation, history, and data-state handling. This establishes the relationships required by later modules.
6. **Build Fleet records and delivery relationships.** Add stable truck identifiers, historical preservation, and delivery history before presenting fleet profitability.
7. **Implement source-traceable financial records.** Only after Finance approves category definitions, precision, dates, corrections, and duplicate-cost rules. Add deterministic calculation and reconciliation tests before surfaces expose totals.
8. **Implement access-sensitive modules in dependency order.** HR compensation requires its own sensitive-field decisions; global search, reports, profitability, and dashboard should consume authorized shared services rather than page-local data.
9. **Finish with cross-module reconciliation and accessibility/regression testing.** Validate date boundaries, security on direct requests, history, report/dashboard reconciliation, keyboard/responsive behavior, and documentation accuracy.

## I. Questions for the Owner

1. Is the README's Supabase/Auth.js/shadcn/Lucide stack an approved target architecture, or should it be revised to describe only the current preview until a target is approved?
2. What is the minimum approved first release slice: completed delivery records only, or delivery records plus POD, truck references, and financial entries?
3. Which canonical delivery statuses and completion requirements are approved, including whether POD is required before a record is final?
4. Which user roles and actions are approved for the first slice, and which actions must be explicitly denied until later?
5. What provider/policy should govern authentication, database migrations, private POD storage, and audit history?
6. What timezone, business-day boundary, PHP precision/rounding rule, and correction/void policy apply before date filters or financial totals become authoritative?

## Limits of this study

This report verifies the checked-in repository only. It does not claim that absent services do not exist outside the repository, that preview figures are correct, or that intended requirements have owner approval. No code, dependency, infrastructure, database, or business-rule change was made during this study.
