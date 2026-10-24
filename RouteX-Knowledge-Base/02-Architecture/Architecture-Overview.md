# Architecture Overview

## Intended architecture
A single Next.js web application handles the interface and server-side application logic. PostgreSQL via Supabase stores structured records; Supabase Storage stores POD documents; Auth.js provides authentication; Vercel is the proposed deployment platform.

```text
Authorized browser
       |
       v
Next.js App Router (React / TypeScript)
       |
       +-- Server Actions / Route Handlers
       |       +-- Authentication and server-side authorization
       |       +-- Validation and business rules
       |       +-- Audit events
       |
       +--> PostgreSQL (Supabase)
       +--> Supabase Storage (private POD files)
       |
       v
Vercel deployment
```

## Constraints
- One Next.js app; no separate backend application.
- No Prisma under the current technical constraint.
- npm package manager.
- Never trust client-only permission checks.
- Keep service secrets server-side.
- Use one shared financial calculation path for UI, reports, and exports.

## Validation spike
Auth.js + Supabase integration and session/authorization boundaries must be verified in a small technical spike before relying on assumptions. The exact schema, migrations approach, connection strategy, deployment configuration, and storage policy are not finalized here.
