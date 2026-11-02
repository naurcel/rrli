# RouteX Design Philosophy

**Document Role:** Foundational visual identity, aesthetic direction, and core design principles for the RouteX frontend.  
**Related Documents:** [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) · [LAYOUT_AND_SPACING.md](./LAYOUT_AND_SPACING.md) · [COMPONENT_DESIGN.md](./COMPONENT_DESIGN.md) · [INTERACTION_AND_MOTION.md](./INTERACTION_AND_MOTION.md) · [TYPOGRAPHY_AND_HIERARCHY.md](./TYPOGRAPHY_AND_HIERARCHY.md) · [UI_STATES_AND_FEEDBACK.md](./UI_STATES_AND_FEEDBACK.md) · [FRONTEND_CONVENTIONS.md](./FRONTEND_CONVENTIONS.md)

---

## 1. Visual Identity & Aesthetic Character

RouteX is an operational and financial workspace built for sustained daily use. Its visual language—implemented in [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css)—combines **warm tactile neumorphism** with **translucent frosted glass** over a calm, daylight-first stone canvas (`#f6f7f9`) and a paired deep-charcoal dark theme (`#141a21`).

Rather than defaulting to either a sterile flat spreadsheet look or an overly dark "command center" aesthetic, RouteX establishes a distinct visual personality through four traits:

1. **Warm Industrial Precision:** Deep amber and burnt-orange accents (`#b45309`, `#7c2d12`, `#f59e0b`) replace generic corporate blue across primary headings, active indicators, focus rings, and interactive highlights.
2. **Tactile Surface Depth:** Cards, toolbars, and controls feel physically grounded through paired dual-directional shadows (a cool slate drop shadow balanced by a crisp white top-left highlight) and subtle recessed wells (`--shadow-inset`) for search boxes and text inputs.
3. **Atmospheric Frosted Glass:** Floating chrome, active navigation pills, KPI cards, and data containers use semi-translucent surfaces (`rgba(255, 255, 255, 0.72)` to `0.86`) with `10px–18px` backdrop blur and crisp `1px` specular borders (`--glass-border`).
4. **Quiet Data Density:** High-volume tables, multi-column KPI grids, and detail drawers prioritize legibility and scannable alignment. Decorative chrome recedes so that identifiers, dates, monetary values, and status dots remain immediately readable.

> **Historical Note on Design Evolution:** Early planning notes (`ADR-003`) described a dark-only `#020617` prototype using `Plus Jakarta Sans` and `#F97316` orange, while the earliest Next.js scaffold used forest-green (`#27654d`) accents. Both were superseded in the live codebase by the **Readex Pro + Warm Amber Neumorphic/Glass** system documented across this collection.

---

## 2. Core Design Principles

### 2.1 Clarity Over Decoration
Every visual effect in RouteX must serve spatial orientation or data comprehension:
- **Directional ambient glows** (`--glow-amber`, `--glow-success`) softly tint the top-right corner of summary and record cards (`radial-gradient(110% 100% at 100% 0%, ...)`) to orient the eye without reducing text contrast.
- **Status indicators** inside dense tables use compact `6px` colored dots paired with plain text (`.pod-status`) rather than heavy, full-pill background fills that would visually clutter multi-row lists.
- **Typography** relies on a single geometric humanist sans-serif family (`Readex Pro`) across all headings, controls, and tables, using weight, size, letter-spacing, and tonal contrast—rather than font switching—to establish hierarchy.

### 2.2 Persistent Spatial Context
Users reviewing records should never lose their place in the workspace:
- **Locked Viewport Shell:** The outer document (`html`, `body`, `.app-shell`) is locked to `100vh` (`overflow: hidden`). Only the main workspace pane (`.main-content`) and independent drawer/table containers scroll.
- **Non-Modal Detail Inspection:** Selecting a table row opens the [`RecordDetailDrawer`](file:///c:/Users/suchi/Documents/rrli/src/components/record-detail-drawer.tsx) as a dedicated right-hand workspace column (`400px` wide on desktop). Rather than dimming the screen with a modal backdrop (`.record-detail-backdrop { display: none }`), the main content area smoothly interpolates its width (`calc(100vw - var(--operational-sidebar-width) - var(--record-detail-reserved))`), keeping the left sidebar, topbar, and table rows interactive and visible.

### 2.3 Progressive Disclosure of Complexity
Screens present the primary scanning path first and reveal secondary controls only when requested:
- **Primary vs. Secondary Filters:** Table toolbars (`.filters`) expose a primary search box and one or two high-frequency `RoundedSelect` dropdowns inline. Less frequent refinements (such as Driver, Client, Truck, or Financial Flow) are tucked behind a `.more-filters-control` button that opens an anchored `.more-filters-popover`.
- **Collapsible Sections:** Multi-part pages (such as the Owned vs. Subcontracted sections on `/fleet`) provide an explicit disclosure toggle (`.fleet-section-toggle-full`) with smooth height/opacity transitions so users can collapse card grids when focusing on tables below.
- **Sequential Form Capture:** Complex creation flows (such as `/deliveries/new`) break inputs into numbered stages (`.delivery-stepper`) rather than presenting an overwhelming single-scroll form.

### 2.4 Honest Interface Boundaries
RouteX explicitly communicates when an action, calculation, or data source is local, provisional, or restricted:
- **Unavailable Actions Stay Visible When Contextual:** Controls whose backing permissions or export formats are not yet connected remain visible in their expected toolbar slot with `disabled`, a subtle lock glyph (`<span className="lock">◌</span>`), and an explanatory `title` attribute.
- **Explicit Scope Framing:** Pages operating on browser-local or sample data pair a dismissible top `.notice` banner with a muted footer `.scope-note` (`● Local data only · ...`) so users never confuse preview interactions with committed server state.

### 2.5 Responsive Tactility & Motion Respect
The interface rewards fine-pointer interaction while remaining fast and accessible for keyboard and reduced-motion users:
- **Pointer-Reactive Lighting:** On fine-pointer devices (`(hover: hover) and (pointer: fine)`), [`MouseReactiveShadows`](file:///c:/Users/suchi/Documents/rrli/src/components/mouse-reactive-shadows.tsx) subtly shifts card and input shadow offsets (`--mouse-shadow-x`, `--mouse-shadow-y` within `±8px`) in response to cursor position.
- **Strict Reduced-Motion Compliance:** Every keyframe animation, hover lift, and pointer-reactive shadow is disabled when `@media (prefers-reduced-motion: reduce)` is active.

---

## 3. Dual-Theme Architecture (Light & Dark Parity)

RouteX supports full **Light** and **Dark** theme parity, controlled via `document.documentElement.dataset.theme` (`"light"` | `"dark"`) and persisted in `localStorage` under `"routex-theme"` ([src/components/theme-toggle.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/theme-toggle.tsx)).

| Visual Layer | Light Mode Character (`:root`) | Dark Mode Character (`html[data-theme="dark"]`) |
| :--- | :--- | :--- |
| **Page Canvas** | Cool warm-stone off-white (`#f6f7f9`) with subtle amber (`rgba(245, 158, 11, 0.1)`) and white ambient radial gradients. | Deep charcoal-slate (`#141a21`) with warm amber (`rgba(243, 164, 41, 0.1)`) and muted steel (`rgba(55, 70, 84, 0.24)`) ambient gradients. |
| **Elevated Surfaces** | Pure white (`#ffffff`) and frosted white glass (`rgba(255, 255, 255, 0.72–0.86)`) with bright white specular borders. | Deep slate (`#1b232c` / `rgba(27, 35, 44, 0.84)`) with subtle steel-blue translucent borders (`rgba(145, 164, 178, 0.2)`). |
| **Neumorphic Shadows** | Soft cool-grey drop shadows paired with crisp white upper-left highlights. | Deep black drop shadows (`rgba(0, 0, 0, 0.3–0.38)`) paired with muted slate upper-left highlights (`rgba(58, 72, 84, 0.14)`). |
| **Brand Accent** | Rich burnt amber (`#b45309` / `#7c2d12`) for high contrast against light surfaces. | Luminous gold-amber (`#f3a429` / `#ffd187`) for legibility against dark slate surfaces. |
| **Floating Popovers** | **Strictly opaque** (`#ffffff` or `rgba(255, 255, 255, 0.94)`) so underlying table text never bleeds through. | **Strictly opaque** (`#1b232c` or `rgba(28, 37, 47, 0.98)`) to preserve contrast over dense data rows. |

---

## 4. Document Map

Use the companion documents in this folder for implementation-specific rules:

- **[DESIGN_TOKENS.md](./DESIGN_TOKENS.md):** Exact hex/RGBA values, CSS custom properties, shadows, radii, and icon sizing.
- **[LAYOUT_AND_SPACING.md](./LAYOUT_AND_SPACING.md):** App shell dimensions, sidebar states, `.content-wrap` padding, grids, and responsive breakpoints.
- **[COMPONENT_DESIGN.md](./COMPONENT_DESIGN.md):** Structural markup, CSS classes, and variants for buttons, inputs, selects, tables, cards, drawers, and popovers.
- **[INTERACTION_AND_MOTION.md](./INTERACTION_AND_MOTION.md):** Hover states, focus rings, pointer-reactive shadows, keyframe animations, and keyboard accessibility.
- **[TYPOGRAPHY_AND_HIERARCHY.md](./TYPOGRAPHY_AND_HIERARCHY.md):** `Readex Pro` type scale, gradient headings, tabular numbers, and text contrast pairing.
- **[UI_STATES_AND_FEEDBACK.md](./UI_STATES_AND_FEEDBACK.md):** Visual patterns for success, warning, error, informational, empty, loading, disabled, and urgent states.
- **[FRONTEND_CONVENTIONS.md](./FRONTEND_CONVENTIONS.md):** Component organization, global CSS authoring rules, state synchronization, and accessibility checklists.

