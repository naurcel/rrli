# Architecture and Repository Discovery

## Purpose
This document helps Codex work with the actual repository rather than assuming a preferred stack is already present.

## Expected stack to verify, not blindly impose
The currently expected direction has been described as:
- Next.js App Router
- React and TypeScript
- Tailwind CSS
- shadcn/ui and Lucide icons
- Next.js Server Actions and Route Handlers
- PostgreSQL through Supabase
- Auth.js
- Supabase Storage
- Vercel deployment
- npm

These are expectations only. Confirm them from repository files and approved project decisions before changing code. Do not migrate the project to this stack just because it appears here.

## Repository inspection checklist
- [ ] Root files and existing agent instructions inspected.
- [ ] `package.json` and lockfile inspected.
- [ ] Framework and library versions recorded.
- [ ] App routes and layouts mapped.
- [ ] Shared UI components identified.
- [ ] Styling entry points, CSS variables, Tailwind config, and theme support identified.
- [ ] Database schema and migrations inspected.
- [ ] Authentication and authorization patterns identified.
- [ ] File upload/storage patterns identified.
- [ ] Validation and error handling conventions identified.
- [ ] Tests and CI scripts identified.
- [ ] Environment variable names documented without exposing secret values.
- [ ] Git status and branch recorded without modifying existing work.

## Architecture principles
1. Follow the established conventions unless a concrete problem justifies change.
2. Keep domain logic separate from visual components when the current stack permits it.
3. Reuse shared components for tables, filters, dialogs, form fields, status labels, and empty/error states.
4. Keep validation close to trust boundaries and enforce critical rules on the server.
5. Use migrations for schema changes; never silently alter production data.
6. Avoid introducing new dependencies for a feature already supported by the stack.
7. Avoid one giant component for a whole module. Split based on clear responsibilities, not arbitrary file-count targets.
8. Avoid excessive abstraction for one-off behavior, but centralize patterns that are repeated or likely to change together.

## Suggested feature structure
Adapt this to the live project. Do not create every folder if the repository uses a different convention.

A possible feature-oriented structure:
- `app/` for routes, layouts, and route-level composition.
- `components/ui/` for low-level reusable primitives.
- `components/shared/` for application-wide patterns.
- `features/deliveries/` for delivery-specific UI and domain behavior.
- `features/fleet/` for truck/fleet behavior.
- `features/financials/` for financial records.
- `features/hr/` for compensation summaries.
- `features/profitability/` for profitability views.
- `lib/` for shared server/client utilities where appropriate.
- `db/` or the project's existing database location for schema/migrations.
- `docs/` for maintained project documentation.

Do not force this layout onto an existing project without evaluating the trade-offs.

## Repository map deliverable
After Phase 0, record:
- Route → module → primary files.
- Data model → source-of-truth tables/collections.
- Shared UI primitives.
- Authorization enforcement points.
- Style tokens and theme entry points.
- Commands for lint, type-check, tests, and build.
- Known architectural debt and what should not be refactored yet.
