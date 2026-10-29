# RouteX

RouteX is an internal truck profitability and delivery operations system for
Redeemed Route Logistics Inc. The repository currently contains a polished,
static application preview plus the first credential-independent pieces of the
planned backend foundation.

## Current state

- All operational pages render local preview data.
- Supabase is not connected and no production schema or migrations exist.
- The login page uses Supabase email/password authentication when public
  project configuration is present.
- Unconfigured development builds retain explicit preview access; unconfigured
  production builds fail closed and redirect operational routes to Login.
- Routes verify authentication, but role authorization and Row-Level Security
  are not implemented yet.
- Financial calculations and workflow rules remain provisional.

Do not treat preview values, status options, roles, or profitability figures as
approved production behavior.

## Verified stack

- Next.js 16.4.2 App Router
- React 19.3.0
- TypeScript 5
- Tailwind CSS 4
- Supabase JavaScript and SSR clients (foundation only)
- Zod 4
- Node's built-in test runner
- npm

The target architecture is documented in
[`RouteX Architecture Blueprint v1.md`](./RouteX%20Architecture%20Blueprint%20v1.md).
That document is a provisional working specification. Exact database tables,
permissions, RLS policies, workflows, and financial rules still require owner
approval before implementation.

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The preview UI builds without Supabase credentials. To prepare a local
Supabase connection, copy `.env.example` to `.env.local` and provide the public
project URL and publishable key. Never commit `.env.local`, service-role keys,
access tokens, or passwords.

## Validation

```bash
npm test
npm run typecheck
npm run build
```

There is currently no lint script or browser automation suite.

## Foundation boundaries

- `src/lib/config` validates public runtime configuration.
- `src/lib/supabase` separates browser and request-scoped server clients.
- `src/lib/auth` provides a server-only verified-identity primitive based on
  Supabase JWT claims.
- `src/lib/errors` defines public-safe error serialization.
- `src/lib/logging` defines a small server-only structured event boundary.

The authentication boundary is wired through `src/proxy.ts`: it refreshes and
verifies configured Supabase sessions before operational routes render. The
login form can establish a configured Supabase session and safely restores an
internal return path. A shared sidebar account control signs out the current
device when Supabase is configured and exits the local preview otherwise.
Password recovery, session-duration preferences, role authorization, database
access, storage, and RLS remain unimplemented pending their approved contracts.

## Product scope

RouteX is intended for post-delivery records, fleet records, supporting
documents, approved financial records, retrieval, reporting, and profitability
review. Live GPS tracking, dispatch optimization, a customer portal, and a full
accounting or payroll replacement are outside the current scope.
