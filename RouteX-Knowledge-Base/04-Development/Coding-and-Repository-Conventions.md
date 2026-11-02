# Coding and Repository Conventions

- TypeScript throughout the application.
- Keep the project as one Next.js app; no separate backend app.
- Do not use Prisma under the current constraint.
- Validate and authorize in server-side code, not only in React components.
- Centralize financial calculations and avoid duplicating formulas across screens/reports.
- Keep data-access boundaries explicit; use typed inputs/outputs and handle validation errors.
- Use the established Tailwind 4 and custom shared-component patterns. Do not assume
  shadcn/ui or Lucide React: neither is installed in the current application.
- Add tests for financial calculations, permissions, corrections/voids, and historical relationships.
- Avoid presenting mock data or placeholder controls as production functionality.

The current automated test runner is Node's built-in `node:test`; backend migrations,
RBAC, and production validation conventions remain pending. See
[Current Implementation State](../../docs/CURRENT_IMPLEMENTATION_STATE.md).
