# Coding and Repository Conventions

- TypeScript throughout the application.
- Keep the project as one Next.js app; no separate backend app.
- Do not use Prisma under the current constraint.
- Validate and authorize in server-side code, not only in React components.
- Centralize financial calculations and avoid duplicating formulas across screens/reports.
- Keep data-access boundaries explicit; use typed inputs/outputs and handle validation errors.
- Use shared UI patterns from shadcn/ui/Tailwind and Lucide React.
- Add tests for financial calculations, permissions, corrections/voids, and historical relationships.
- Avoid presenting mock data or placeholder controls as production functionality.

Exact directory naming, lint/format rules, test framework, migration convention, branch strategy, and commit convention should be defined from the actual repository once available.
