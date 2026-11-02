# Development Overview

RouteX currently runs as one Next.js 16.4.2 App Router application using React
19.3.0, TypeScript 5, Tailwind CSS 4, custom shared components, and npm. The
current frontend is intentionally local-data only; create flows and truck-photo
edits are browser-local, and no database or production storage is connected.

The target remains a single Next.js application with server-side application
logic, PostgreSQL through Supabase, Supabase Auth, private Supabase Storage for
POD documents, and Vercel as the proposed deployment platform. No Prisma or
separate backend app is approved. See
[Current Implementation State](../../docs/CURRENT_IMPLEMENTATION_STATE.md).

Before backend implementation, resolve business rules and access-control blockers in
[Issues and TODOs](../08-Logs/Issues-and-TODOs.md). Validate Supabase Auth,
schema/migration, storage, and server-authorization approaches in a technical spike.
