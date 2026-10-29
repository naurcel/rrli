# Unified Rounded Dropdowns

**Date:** 2026-10-29  
**Scope:** Frontend filter controls only

## Changes

- Added one reusable `RoundedSelect` client component for filter menus.
- Replaced the Fleet owned-truck type selector with the rounded menu treatment used by the Delivery POD filter.
- Replaced the Fleet subcontractor status, Delivery driver, and Transaction status native selectors with the same component.
- Standardized trigger height, radius, padding, CSS chevron, menu radius, spacing, selected state, hover state, glass surface, and dark-mode shadows.
- Preserved existing filtering values and behavior.
- Kept outside-click and Escape closing plus the existing open/close animation.
- Removed the superseded page-local POD dropdown and obsolete native-select styling hooks.

## Files

- Created `src/components/rounded-select.tsx`.
- Updated `src/app/page.tsx`.
- Updated `src/app/fleet/page.tsx`.
- Updated `src/app/transactions/page.tsx`.
- Updated `src/app/globals.css`.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 17/17.
- `npm run build`: passed; all application routes were statically generated.
- No browser automation was available for pixel-level visual comparison.

## Manual review checklist

- Open All types on Fleet and confirm the trigger and menu are rounded.
- Open POD, driver, subcontractor status, and transaction status menus and confirm they use the same surface, spacing, selected state, and chevron animation.
- Verify outside-click and Escape close each menu.
- Verify selection still filters the corresponding records.
- Check the menus in both light and dark mode.
