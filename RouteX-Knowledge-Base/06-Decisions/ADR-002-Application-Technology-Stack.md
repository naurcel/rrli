# ADR-002: Application Technology Stack

- **Status:** Accepted working constraint; configuration details TBD
- **Sources:** [Tech Stack](../02-Architecture/Tech-Stack.md); current project README and SRS

## Decision
Use Next.js 15 App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Next.js Server Actions and Route Handlers, PostgreSQL via Supabase, Auth.js, Supabase Storage, Vercel, and npm. Do not use Prisma or a separate backend application under current constraints.

## Consequences
Auth.js/Supabase integration, database access, private storage policy, and deployment configuration must be validated in a technical spike. Hosting account ownership and payment are unresolved.
