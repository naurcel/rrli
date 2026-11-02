# Hosted Preview Login

**Date:** 2026-10-29  
**Scope:** Temporary credential-gated access for unconfigured hosted previews

## Changes

- Added a temporary hosted-preview authentication mode for deployments without Supabase configuration.
- Added the preview credentials `admin` / `admin`.
- Added `POST` and `DELETE` handlers at `/api/preview-session` to create and clear a 12-hour session cookie.
- The cookie is HttpOnly, Secure in production, SameSite=Lax, and scoped to the application path.
- Updated the Next Proxy so unconfigured hosted previews redirect unauthenticated operational routes to Login, while a valid preview session can access the interface.
- Updated Login and the account menu to create and clear the hosted preview session.
- Logout now uses a full document replacement in local preview, hosted-preview, and Supabase modes. This prevents a stale client-route payload from rendering a blank Login screen after a session change.
- Preserved existing behavior: configured Supabase deployments use Supabase sign-in; local development remains directly accessible as its existing preview mode.

## Boundary

This is a temporary access gate for the local-data UI preview, not production authentication or authorization. The shared `admin` / `admin` credential must be replaced with a real identity provider before the system stores or exposes non-preview operational data.

## Files

- Added `src/app/api/preview-session/route.ts`.
- Added `src/lib/auth/preview-session.ts` and its unit test.
- Updated `src/app/login/page.tsx`, `src/components/account-control.tsx`, `src/proxy.ts`, `src/features/auth/auth-model.ts`, route-policy tests, authentication tests, and `package.json`.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 19/19.
- `npm run build`: passed; the new API route is generated as a dynamic route.
- Production-server checks:
  - anonymous Dashboard request: HTTP 307 to Login;
  - invalid credentials: HTTP 401;
  - `admin` / `admin`: HTTP 200 and a Secure, HttpOnly, SameSite=Lax cookie;
  - Dashboard request carrying the valid preview session: HTTP 200.

## Deployment note

The change is ready for the next Vercel deployment. No deploy, commit, or push was performed in this stage.
