# Overnight Engineering Report - 2026-10-28

> Current-state note: authentication and current-device sign-out were added
> after this foundation report. See reports 18 and 19 for the later verified
> state.

## Outcome

RouteX now has a tested, credential-independent backend foundation aligned with
Architecture Blueprint v1. The work deliberately stops before schema,
authentication wiring, authorization, RLS, storage, or business workflows
because their exact contracts remain provisional or unresolved.

## Repository findings

- The live application uses Next.js 16.4.2 App Router, React 19.3.0,
  TypeScript, Tailwind CSS 4, and npm.
- All nine application routes are static preview surfaces backed by local data.
- At the start of this session, the login screen did not authenticate and
  operational routes were not protected.
- Before this session there was no Supabase dependency, environment contract,
  server/client database boundary, application error contract, or backend
  logging boundary.
- There is no schema, migration history, configured Supabase project, RLS,
  private storage bucket, generated database type, or browser test suite.
- Architecture Blueprint v1 is marked `Provisional working specification`.
  It selects the intended platform but also leaves exact schema, permission,
  audit, import, and business-rule details subject to approval.
- Existing dark-mode and design work was present in the working tree and was
  preserved.

## Completed work

### Dependencies and environment contract

- Added `@supabase/supabase-js`, `@supabase/ssr`, `zod`, and `server-only`.
- Added `.env.example` with only the public Supabase URL and publishable key.
- Kept all `.env*` files ignored except the safe example file.
- Added Zod validation that reports invalid variable names without echoing
  their values.

### Server and browser boundaries

- Added a dedicated browser Supabase client factory.
- Added a request-scoped, server-only Supabase client factory based on the
  current asynchronous Next.js cookie API.
- Kept cookie mutation and global session refresh unwired. Those concerns must
  be implemented together with an approved protected-route policy and a
  response-aware Next Proxy.
- Added server-only verified identity helpers using `auth.getClaims()` rather
  than trusting browser-provided role or session data.
- Did not add role checks because the role/permission schema and matrix are not
  approved.

### Reliability and security groundwork

- Added a typed application-error contract and safe public serializer.
- Unexpected and non-exposable server errors are reduced to a generic message.
- Added a constrained structured server logger whose fields discourage tokens,
  request bodies, credentials, and personal data.
- Expanded the test command from five sidebar-state tests to eleven total tests
  covering environment validation and error redaction.

### Documentation

- Replaced stale README claims about Next.js 15 and Auth.js with the verified
  live stack and the actual preview/backend state.
- Recorded Blueprint v1 as a proposed stack decision, not an approved set of
  product rules.
- Added this report and updated the central handoff log.

## Files added

- `.env.example`
- `src/lib/auth/verified-identity.ts`
- `src/lib/config/env.ts`
- `src/lib/config/env.test.ts`
- `src/lib/errors/app-error.ts`
- `src/lib/errors/app-error.test.ts`
- `src/lib/logging/server-logger.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `RouteX_Codex_Development_Kit/docs/reports/17-overnight-engineering-report-2026-10-28.md`

## Files modified for this work

- `.gitignore`
- `package.json`
- `package-lock.json`
- `README.md`
- `RouteX_Codex_Development_Kit/docs/12-decisions-and-open-questions.md`
- `RouteX_Codex_Development_Kit/docs/13-progress-and-handoff.md`

Pre-existing application/theme changes and the untracked Blueprint file were
not overwritten or removed.

## Validation

| Command | Result |
|---|---|
| `cmd /c npm test` | Passed: 11 tests, 0 failures |
| `cmd /c npm run typecheck` | Passed |
| `$env:NODE_OPTIONS='--max-old-space-size=4096'; cmd /c npm run build` | Passed; all nine routes generated as static pages |
| Dependency installation output | 0 vulnerabilities reported |

No browser automation package is configured, so visual or interaction
regression testing was not performed. No Supabase connectivity test was
possible because no project URL, publishable key, or backend project is
configured.

## Remaining issues and risks

- Login and route authentication are now implemented as documented in report
  18, but remain unverified against a real Supabase project and test account.
- Current-device sign-out is now implemented as documented in report 19.
- Role authorization, RLS, and connected operational data remain unimplemented.
- The server Supabase client is verification/read oriented. Auth mutations and
  refresh require a response-aware Proxy that propagates both cookies and
  no-cache headers.
- No database types can be generated until a schema and project exist.
- No migration should be written until entity definitions and ownership are
  approved.
- No RLS policy should be written until the account profile and permission
  model are approved.
- POD storage cannot be implemented safely until ownership, access, retention,
  correction, and audit behavior are approved.
- The current test suite does not exercise routes in a browser or a database.

## Pending owner decisions

The highest-priority blockers remain:

1. Approval or revision of Blueprint v1 as the architecture baseline.
2. Exact staff-account/profile schema and role-to-permission matrix.
3. Protected versus public route policy, session lifetime, and account
   lifecycle behavior.
4. Canonical delivery, client, truck, and location tables and constraints.
5. Approved status transitions, correction/void policy, and audit-event schema.
6. POD access, retention, replacement, and deletion policy.
7. Financial categories, completion requirements, calculations, rounding, and
   correction rules.
8. Development/staging/production Supabase project and deployment ownership.

## Recommended next step

Configure a development Supabase project and test account, then verify the
implemented sign-in, refresh, route-protection, and sign-out paths from reports
18 and 19. After that, approve the staff profile and permission contract before
implementing one reviewable data foundation stage containing:

- checked-in Supabase CLI configuration and an approved initial migration,
- generated database types,
- staff profile/permission tables and RLS,
- integration tests for the existing response-aware session boundary,
- role-aware server authorization and protected-route tests.

Only after that foundation is verified should the first persisted delivery
vertical slice begin. No commit, push, deployment, database mutation, or
destructive operation was performed in this session.
