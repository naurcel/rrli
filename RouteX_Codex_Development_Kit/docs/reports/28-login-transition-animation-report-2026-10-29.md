# Login Transition Animation

**Date:** 2026-10-29  
**Scope:** Sign-in navigation feedback

## Changes

- Added a short fade-and-blur transition between successful sign-in and application navigation.
- Removed the RouteX interstitial mark and “Opening RouteX” message after visual review.
- The visual and form panels fade and blur out together; initial login surfaces and their contents fade and blur in with a small stagger similar to application page entrances.
- The submit label remains in its signing-in state and disabled during the transition.
- Applied the transition to both local preview sign-in and configured Supabase sign-in.
- Preview mode now honors the same sanitized internal return path as configured authentication; the default remains `/dashboard`.
- Sign-in uses route replacement so browser Back does not immediately return to the login form.
- Added dark-mode treatment and immediate navigation for users who prefer reduced motion.
- Replaced the static city login visual with the supplied animated blue glow GIF at `public/branding/login-glow.gif`.
- Rendered the GIF as an explicit media element instead of a CSS background so stale generated styles cannot preserve the former city image.
- Added a dedicated `login-surface-out` keyframe so the entrance animation's fill state cannot override the sign-in fade-and-blur exit.
- Delayed route replacement to 480 ms, leaving the 420 ms exit animation enough time to finish before Dashboard mounts.

## Files

- Updated `src/app/login/page.tsx`.
- Updated `src/app/globals.css`.
- Added `public/branding/login-glow.gif`.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 17/17.
- `npm run build`: passed; all application routes were generated.
- Live `/login`: HTTP 200 with local preview mode present; the removed interstitial markup is absent.
- Live GIF asset: HTTP 200; 3,368,739 bytes served.
- Restarted the verified local development server after confirming its generated CSS bundle was stale; the live bundle now contains the GIF media styles and no `route-city.jpg` reference.
- Cleared only the generated `.next` cache after a stale Turbopack bundle continued serving the previous exit rule; the rebuilt live CSS contains `login-surface-out` and `/login` contains the GIF asset.

## Manual review checklist

- Open `/login` and select Sign in.
- Confirm the panels fade and blur out cleanly and navigation finishes at `/dashboard`.
- Reload Login and confirm its surfaces and individual elements fade and blur in with a subtle stagger.
- Confirm the supplied blue glow GIF animates in the left visual panel.
- Confirm repeated clicks are prevented during the transition.
- Check light and dark mode.
- Enable reduced motion at the OS/browser level and confirm navigation occurs without the transition delay.
