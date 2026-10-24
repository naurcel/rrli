# Design System and Styling: Flexible by Design

## Goal
Visual changes should be fast, predictable, and global where appropriate. A change to the brand accent, radius, typography, spacing scale, or table density should not require manually editing every screen.

## Current design direction
- Readex Pro typography, subject to verified font-loading and licensing constraints.
- Light theme as the default.
- Optional dark theme if supported/approved.
- A light, collapsible sidebar.
- Search and date filters are prominent and easy to find.
- Generous whitespace and strong information hierarchy.
- Rounded corners and restrained status colors.
- Prioritize finding records and understanding truck profitability.
- Avoid maps, marketing hero sections, futuristic control centers, dense analytics walls, and generic KPI grids unless requirements change.

Treat these as changeable design preferences, not hard-coded truths. Keep them centralized so future revisions are cheap.

## The styling contract
Before building or restyling screens:
1. Find the project's actual styling system.
2. Identify the single authoritative location for design tokens.
3. Define reusable semantic tokens, not scattered raw values.
4. Use shared primitives for recurring UI patterns.
5. Keep module-specific exceptions local and explain why they are necessary.
6. Test at least one representative screen after a global style change.
7. Search for and remove obsolete duplicate values after migration, when safe.

## Token categories to centralize
Use the naming convention that fits the actual stack. Example categories, not mandatory exact names:

### Color
- Background: page, surface, elevated surface.
- Text: primary, secondary, muted, inverse.
- Border: default, subtle, strong.
- Accent: primary, hover, foreground.
- Status: success, warning, danger, info, neutral.
- Focus ring and selection.
- Chart colors only if charts are approved.

### Typography
- Font families and fallback stacks.
- Font sizes for display, page title, section title, body, label, caption, and tabular data.
- Font weights.
- Line heights and letter spacing.

### Spacing and sizing
- Consistent spacing scale.
- Page horizontal padding.
- Section gaps.
- Form control heights.
- Sidebar width and collapsed width.
- Table row density.
- Content max width.

### Shape and effects
- Radius scale: small, control, card, modal, pill.
- Border widths.
- Shadows/elevation.
- Focus ring thickness and offset.
- Motion duration and easing, respecting reduced-motion preferences.

### Layout
- Header height.
- Sidebar dimensions.
- Content grid and breakpoints.
- Dialog widths.
- Table minimum widths and overflow behavior.

## Example CSS custom properties
Adapt these to the existing implementation. Do not add a second token system if the repository already has one.

```css
:root {
  --color-background: ...;
  --color-surface: ...;
  --color-text-primary: ...;
  --color-text-secondary: ...;
  --color-border: ...;
  --color-accent: ...;
  --radius-control: ...;
  --radius-card: ...;
  --space-page-inline: ...;
  --font-sans: ...;
  --shadow-card: ...;
}
```

The ellipses are placeholders, not valid production values. Select values through the project's approved design system.

## Semantic tokens beat literal colors
Prefer semantic roles such as `text-muted`, `surface`, `border-subtle`, `status-danger`, and `accent` rather than raw hex codes scattered through JSX/CSS. A future color palette change should update tokens, not every component.

Do not encode meaning with color alone. Pair status color with text, an icon, or another accessible cue.

## Shared components worth standardizing
Reuse where the same behavior appears in multiple places:
- Page header and breadcrumbs.
- Search input and date-filter group.
- Filter chips and clear-filters action.
- Data table with consistent sorting, pagination, and empty state.
- Status badge.
- Form field, validation message, and help text.
- Confirmation dialog.
- Toast/notification pattern.
- Loading skeleton.
- Empty state and error state.
- Currency and date display.
- Permission-aware action area, while retaining server-side authorization.
- Record details panel and audit/history timeline, if required.

Shared components should support controlled variants and semantic props. Avoid making a giant universal component with dozens of boolean props. If two variants behave differently, define clear variants or separate components.

## Component API principles
- Prefer semantic props: `variant="subtle"`, `density="compact"`, `status="warning"`.
- Avoid requiring each page to pass custom colors, spacing, and radius values.
- Keep defaults useful and consistent.
- Make exceptions possible, but uncommon and explicit.
- Document breaking changes to shared components.
- Avoid screen-specific overrides that undo global design tokens.

## Styling change workflow
When asked to change the design:
1. Clarify whether it is a global design change or a single-module exception if unclear.
2. Locate the source token/component.
3. Estimate affected screens and shared components.
4. Make the smallest centralized change.
5. Check light/dark modes if supported.
6. Check responsive layouts, focus states, and contrast.
7. Verify a table-heavy screen and a form/dialog screen when relevant.
8. Search for inconsistent hard-coded values or old variants.
9. Report the affected surfaces and any exceptions left behind.

## Visual regression checklist
- [ ] Typography hierarchy remains clear.
- [ ] Tables remain readable and usable.
- [ ] Search and date filters remain easy to find.
- [ ] Status meaning is not color-only.
- [ ] Keyboard focus is visible.
- [ ] Layout works at supported widths.
- [ ] Dark mode is checked if supported.
- [ ] No new arbitrary colors/radii/spacing values were scattered into screens.
- [ ] Shared tokens are the source of truth.
- [ ] Existing user preferences are preserved where possible.

## What not to do
- Do not restyle every module independently when a token change will do.
- Do not add new styling libraries without a clear need and approval if it changes project scope.
- Do not put the entire design system in a single screen file.
- Do not use hard-coded values for convenience when a semantic token exists.
- Do not invent a brand palette and claim it was approved.
