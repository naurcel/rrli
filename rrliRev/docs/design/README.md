# RouteX Frontend & Design System Documentation

This directory contains the authoritative frontend, UI, UX, and visual design documentation for **RouteX**. Every specification is grounded in the verified implementation across [`src/app/globals.css`](../../src/app/globals.css) and [`src/`](../../src/).

---

## Documentation Index

| Document | Purpose & Scope |
| :--- | :--- |
| [1. `DESIGN_PHILOSOPHY.md`](./DESIGN_PHILOSOPHY.md) | Foundational visual identity ("Warm Industrial Precision on Daylight Canvas"), core design principles, search-first retrieval, dedicated full-page inspection, and data density. |
| [2. `DESIGN_TOKENS.md`](./DESIGN_TOKENS.md) | Complete token catalog: light & dark mode CSS custom properties, semantic color roles, `.routex-badge` tokens, elevation shadows, radii, and layout dimensions. |
| [3. `LAYOUT_AND_SPACING.md`](./LAYOUT_AND_SPACING.md) | Application shell (`248px` / `84px` sidebar + independent `.main-content` scroll), sticky topbar, page rhythm, KPI/card grids, and `.routex-dialog-layer`. |
| [4. `COMPONENT_DESIGN.md`](./COMPONENT_DESIGN.md) | Specifications for action buttons, `.routex-badge`, `.routex-dialog` modals, `SearchBuffer`, `GlobalDateRangePicker`, data tables, and `<TablePagination />`. |
| [5. `INTERACTION_AND_MOTION.md`](./INTERACTION_AND_MOTION.md) | Hover/focus/active states, keyboard navigation, transitions, keyframes, and reduced-motion rules. |
| [6. `TYPOGRAPHY_AND_HIERARCHY.md`](./TYPOGRAPHY_AND_HIERARCHY.md) | `Readex Pro` typeface configuration, monospace data codes, heading scale, KPI numbers, and currency alignment. |
| [7. `UI_STATES_AND_FEEDBACK.md`](./UI_STATES_AND_FEEDBACK.md) | Semantic status indicators (`.routex-badge`), attention-needed cards, schedule conflict chips, empty states, and loading feedback. |
| [8. `FRONTEND_CONVENTIONS.md`](./FRONTEND_CONVENTIONS.md) | Next.js App Router architecture, single global `globals.css` rule, `withReturnContext()` navigation, and browser preview state sync. |
