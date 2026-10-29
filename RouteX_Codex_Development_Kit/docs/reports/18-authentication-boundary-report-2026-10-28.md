# Authentication Boundary Report - 2026-10-28

## Outcome

RouteX now has a real Supabase authentication path that activates when valid
public project configuration is present. Operational routes are checked by a
server-side Next Proxy before rendering. The existing local preview remains
available only during development; an unconfigured production server fails
closed and redirects operational requests to Login.

This stage establishes authentication only. It does not claim that role
authorization, RLS, account administration, or business-data protection is
complete.

## What changed

- Added a Zod sign-in schema for email and non-empty password validation.
- Added explicit authentication modes:
  - `supabase` when project configuration is valid,
  - `preview` only when unconfigured in development,
  - `unavailable` when unconfigured outside development.
- Replaced the Login page's unconditional dashboard shortcut with:
  - real `signInWithPassword` behavior in Supabase mode,
  - the existing preview navigation in development preview mode,
  - a safe configuration error in unavailable mode.
- Added pending/submission and accessible form-error states.
- Added safe internal return-path handling and rejection of external or
  protocol-relative redirects.
- Added `src/proxy.ts` using the Next.js 16 Proxy convention.
- Proxy calls `auth.getClaims()` before protected pages render and carries
  refreshed cookies plus required no-cache headers to the response.
- Authenticated visits to Login redirect to Dashboard.
- Unauthenticated visits to operational routes redirect to Login.
- Password recovery and Remember me controls are visibly disabled because
  their policies and implementation are not approved.

## Files added

- `src/features/auth/auth-model.ts`
- `src/features/auth/auth-model.test.ts`
- `src/lib/auth/route-policy.ts`
- `src/lib/auth/route-policy.test.ts`
- `src/proxy.ts`
- `RouteX_Codex_Development_Kit/docs/reports/18-authentication-boundary-report-2026-10-28.md`

## Files modified

- `src/app/login/page.tsx`
- `src/app/globals.css`
- `src/lib/supabase/server.ts`
- `package.json`
- `README.md`
- `RouteX_Codex_Development_Kit/docs/12-decisions-and-open-questions.md`
- `RouteX_Codex_Development_Kit/docs/13-progress-and-handoff.md`

## Validation

| Check | Actual result |
|---|---|
| `cmd /c npm test` | Passed: 17 tests, 0 failures |
| `cmd /c npm run typecheck` | Passed |
| `$env:NODE_OPTIONS='--max-old-space-size=4096'; cmd /c npm run build` | Passed; all static routes generated and Proxy detected |
| Production `/login` without Supabase configuration | HTTP 200 |
| Production `/` without Supabase configuration | HTTP 307 to `/login?configuration=missing` |
| Production `/fleet?status=active` without configuration | HTTP 307; internal return path preserved |

The production route checks used a local `next start` server on port 3110,
which was stopped after verification.

No configured Supabase project or test account was available, so a successful
remote sign-in, token refresh against a real project, and authenticated route
render could not be exercised. No browser automation was available for visual
form-state checks.

## Security boundaries

- The browser never supplies a trusted role.
- Proxy verifies JWT claims before granting configured-mode route access.
- Return URLs are limited to internal RouteX paths.
- Missing production configuration does not enable preview access.
- Login errors do not expose provider or server details.
- No service-role key or privileged Supabase client was introduced.

## Remaining work

- Configure a development Supabase project and test account.
- Exercise real sign-in, refresh, expiration, and invalid-session behavior.
- Current-device sign-out is now available through the shared sidebar account
  control; broader session revocation remains subject to policy approval.
- Approve and implement password recovery, invitation, suspension, and
  session-duration policies.
- Approve the staff profile and permission schema.
- Add server authorization checks and RLS before connecting business data.
- Add integration/browser tests once a test project and runner are available.

No database migration, role rule, RLS policy, business workflow, commit, push,
deployment, or destructive action was performed.
