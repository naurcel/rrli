# Technology Stack

| Layer | Intended technology | Status |
|---|---|---|
| App framework | Next.js 16.4.2 App Router | Implemented in the repository |
| UI | React 19.3.0, TypeScript 5 | Implemented in the repository |
| Styling/components | Tailwind CSS 4 and custom shared components | Implemented; shadcn/ui and Lucide are not installed |
| Server logic | Next.js Server Actions + Route Handlers | Current project constraint |
| Database | PostgreSQL via Supabase | Current project constraint |
| Authentication | Supabase Auth boundary plus temporary hosted preview gate | SDK/boundary implemented; no configured provider or RBAC |
| File storage | Supabase Storage | Intended for POD documents |
| Hosting/deployment | Vercel | Proposed; account owner/payer TBD |
| Package manager | npm | Implemented |

The database, storage, and deployment rows describe target architecture, not
running services. See [Current Implementation State](../../docs/CURRENT_IMPLEMENTATION_STATE.md)
for the active local-data boundary.

Do not introduce Prisma, a separate backend app, or unapproved third-party integrations without an explicit decision and scope review.

> Mirrors: `RouteX_SRS.pdf`, Sections 1.4 and 1.6; `Project_README.md`, Technology Stack. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
