# Account Session Exit Report - 2026-10-28

## Outcome

Every operational page now uses one reusable sidebar account control. In a
configured Supabase environment it signs out the current device and returns to
Login. In development preview mode it exits to Login without pretending to
revoke a backend session.

## Changes

- Added `src/components/account-control.tsx`.
- Replaced seven duplicated sidebar account fragments with the shared control.
- The avatar and overflow button both open the same account menu.
- The avatar remains usable when the sidebar is collapsed.
- The menu closes on outside pointer interaction or Escape.
- Escape restores focus to whichever trigger opened the menu.
- Configured sign-out uses Supabase `scope: "local"`, avoiding an unapproved
  all-device session revocation policy.
- Provider errors are replaced with a safe retry message.
- The menu reports whether it represents an authenticated session or a local
  development preview.
- Added glass/neomorphic menu styling for expanded, collapsed, light, and dark
  token contexts.

## Files

Added:

- `src/components/account-control.tsx`
- `RouteX_Codex_Development_Kit/docs/reports/19-account-session-exit-report-2026-10-28.md`

Modified:

- `src/app/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/fleet/page.tsx`
- `src/app/transactions/page.tsx`
- `src/app/reports/page.tsx`
- `src/app/administration/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/globals.css`
- `README.md`
- decision and handoff documentation

## Validation

- `cmd /c npm test`: passed, 17/17.
- `cmd /c npm run typecheck`: passed.
- Production build: passed; all nine routes and Proxy generated.
- Existing development server `/dashboard`: HTTP 200 and rendered the shared
  account-control trigger.
- Browser automation is unavailable, so click, keyboard, collapsed positioning,
  and sign-out against a real Supabase account still require manual review.

No schema, migration, RLS policy, role rule, database operation, commit, push,
or deployment was performed.
