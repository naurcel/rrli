# Filter Placement, Chevron, and Dark Shadow Correction

**Date:** 2026-10-28  
**Scope:** Shared frontend presentation only

## Changes

- Added a stable `topbar-filter-slot` beside the breadcrumb and moved the portaled global date picker into it.
- Removed the date filter's absolute right positioning and its obsolete generated fallback label.
- Added a reusable CSS `dropdown-chevron` and applied it to the global date filter, POD status dropdown, and Fleet section control.
- Added an inline calendar SVG to the date filter instead of using a font-dependent symbol.
- Replaced white-tinted dark-mode shadow highlights with dark neutral highlights in shared shadow tokens.
- Added dark-mode shadow overrides for controls, hoverable cards, inset search fields, avatars, and the Fleet section header.

## Files modified

- `src/components/operational-topbar.tsx`
- `src/components/global-date-range-picker.tsx`
- `src/app/page.tsx`
- `src/app/fleet/page.tsx`
- `src/app/globals.css`
- `RouteX_Codex_Development_Kit/docs/13-progress-and-handoff.md`
- `RouteX_Codex_Development_Kit/docs/reports/README.md`

## Validation

- `npm test`: passed, 17/17.
- `npm run typecheck`: passed.
- `npm run build`: passed; all routes generated and Proxy detected.
- `git diff --check`: passed with existing line-ending warnings only.
- Live `/fleet` and `/` checks: HTTP 200; filter slot and shared chevron markup present.

## Remaining review

- Manually inspect light and dark modes at desktop and tablet widths.
- Confirm the date popover opens beneath the left-aligned trigger without clipping.
- Confirm hover shadows remain dark-neutral across cards and controls in dark mode.
