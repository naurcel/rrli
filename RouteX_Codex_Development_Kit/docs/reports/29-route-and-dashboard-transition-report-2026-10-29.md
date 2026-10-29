# Route and Dashboard Transitions

**Date:** 2026-10-29  
**Scope:** Shared frontend page entrances and login-to-Dashboard handoff

## Changes

- Added the App Router root `template.tsx` boundary so top-level route content remounts consistently during client navigation.
- Added a shared 560 ms fade, blur, and slight vertical entrance to each application content area while leaving the sidebar outside the animated target.
- Added a Dashboard-specific stagger for the greeting, summary cards, recent-delivery panel, attention panel, table rows, attention items, and scope note.
- Preserved the login surface fade-and-blur exit so sign-in now hands off into the Dashboard entrance rather than an immediately rendered static page.
- Used backwards-only animation fill for application content so completed entrance animations do not continue owning hover transforms or filters.
- Preserved the global reduced-motion behavior.
- Performance follow-up: replaced full-content and per-element blur transitions with lightweight opacity and short translations.
- Reduced login surface blur from 10 px to 3 px while retaining the requested fade-and-blur character.
- Paused mouse-reactive shadow calculations for the first 720 ms of each route entrance.
- Removed backdrop blur from summary cards and changed their invisible continuous border-glow animation to run only while hovered.
- Fleet follow-up: expanded the owned-truck grid's overflow clip margin so last-row shadows render fully, added a stable lower hover shadow, and strengthened the hover-only amber inset highlight pulse.

## Files

- Added `src/app/template.tsx`.
- Updated `src/app/globals.css`.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 17/17.
- `npm run build`: passed; all application routes were generated.
- Live route checks: `/login`, `/dashboard`, `/deliveries`, `/fleet`, `/transactions`, `/reports`, `/administration`, and `/settings` returned HTTP 200.
- Live CSS contains `route-content-in`, `dashboard-element-in`, and `login-surface-out`.
- Browser motion still requires manual review because browser automation is not installed.

## Manual review checklist

- Sign in from `/login` and confirm the login surfaces fade and blur out before Dashboard appears.
- Confirm Dashboard elements reveal in sequence rather than appearing simultaneously.
- Switch among all sidebar pages and confirm the changing content animates while the sidebar remains visually stable.
- Check both light and dark modes.
- Enable reduced motion and confirm transitions become effectively immediate.
