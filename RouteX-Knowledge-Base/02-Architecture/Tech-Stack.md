# Technology Stack

| Layer | Intended technology | Status |
|---|---|---|
| App framework | Next.js 15 App Router | Current project constraint |
| UI | React, TypeScript | Current project constraint |
| Styling/components | Tailwind CSS, shadcn/ui, Lucide React | Current project constraint |
| Server logic | Next.js Server Actions + Route Handlers | Current project constraint |
| Database | PostgreSQL via Supabase | Current project constraint |
| Authentication | Auth.js (formerly NextAuth.js naming in older docs) | Integration validation required |
| File storage | Supabase Storage | Intended for POD documents |
| Hosting/deployment | Vercel | Proposed; account owner/payer TBD |
| Package manager | npm | Current project constraint |

Do not introduce Prisma, a separate backend app, or unapproved third-party integrations without an explicit decision and scope review.

> Mirrors: `RouteX_SRS.pdf`, Sections 1.4 and 1.6; `Project_README.md`, Technology Stack. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
