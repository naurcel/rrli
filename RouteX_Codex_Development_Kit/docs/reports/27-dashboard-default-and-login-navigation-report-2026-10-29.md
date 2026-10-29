# Dashboard Default and Login Navigation

**Date:** 2026-10-29  
**Scope:** Application routes, sign-in destination, and navigation

## Changes

- Moved the Deliveries page from `/` to `/deliveries`.
- Made `/` a server redirect to `/dashboard` so Overview is the default application page.
- Updated the shared sidebar Deliveries link and active-route matching.
- Updated Dashboard's View all link to open `/deliveries`.
- Confirmed preview sign-in already navigates to `/dashboard`.
- Confirmed configured Supabase sign-in defaults to `/dashboard` when no valid internal return path is supplied.
- Normalized an explicit login return path of `/` to `/dashboard`, while preserving intentional internal destinations such as `/deliveries`.
- Added route-policy assertions for the new default and Deliveries route.

## Files

- Moved `src/app/page.tsx` to `src/app/deliveries/page.tsx`.
- Created a new redirect-only `src/app/page.tsx`.
- Updated `src/components/operational-sidebar.tsx`.
- Updated `src/app/dashboard/page.tsx`.
- Updated `src/lib/auth/route-policy.ts` and its tests.
- Updated current roadmap and handoff documentation.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 17/17.
- `npm run build`: passed; `/deliveries` is included as a static route.
- Live `/`: HTTP 307 with destination `/dashboard`.
- Live `/login`: HTTP 200.
- Live `/dashboard`: HTTP 200.
- Live `/deliveries`: HTTP 200.

## Manual review checklist

1. Open `/login`.
2. In local preview mode, select Sign in and confirm navigation to `/dashboard`.
3. Open `http://localhost:3000` and confirm it resolves to `/dashboard`.
4. Select Deliveries in the sidebar and confirm the URL is `/deliveries` and the Deliveries item is active.
5. Select View all in Recent deliveries and confirm it opens `/deliveries`.
