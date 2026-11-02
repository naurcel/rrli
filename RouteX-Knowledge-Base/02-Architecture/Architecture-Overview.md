# Architecture Overview

## Current verified implementation

RouteX currently runs as one Next.js 16.4.2 App Router frontend using React
19.3.0, TypeScript, Tailwind CSS 4, and custom shared components. It has local
fixtures and selected browser-local writes only. Supabase client libraries and
a route-authentication boundary are present, but there is no configured
Supabase project, database schema, migration, server CRUD, storage, RLS, or
role enforcement. The temporary hosted preview gate is not production
authentication.

The intended architecture below remains a target, not a statement that these
services are running. See [Current Implementation State](../../docs/CURRENT_IMPLEMENTATION_STATE.md).

## Intended architecture
A single Next.js web application is the intended application boundary.
PostgreSQL via Supabase is the proposed structured-record store; Supabase
Storage is proposed for POD documents; Supabase Auth is the selected future
authentication direction; Vercel remains the proposed deployment platform.

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
Supabase session and authorization boundaries still need verification against a
real project. The exact schema, migrations approach, connection strategy,
deployment configuration, and storage policy are not finalized here.
