# RouteX Interaction and Motion

**Document Role:** Specification for pointer interactions, hover/active/focus states, popover choreography, transitions, keyframe animations, and keyboard/reduced-motion accessibility.  
**Related Documents:** [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) · [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) · [COMPONENT_DESIGN.md](./COMPONENT_DESIGN.md) · [UI_STATES_AND_FEEDBACK.md](./UI_STATES_AND_FEEDBACK.md)

---

## 1. Motion Signature & Easing Curves

RouteX uses purposeful, low-latency motion to reinforce spatial relationships without delaying user input:

- **Primary Spring-Deceleration Curve:** `cubic-bezier(.22, 1, .36, 1)` — used across page entries, sidebar expansion, drawer slide-ins, popover openings, card entrances, and navigation indicators. It starts briskly and settles softly without overshoot.
- **Standard Micro-Interaction Easing:** `ease` (`0.15s–0.35s`) for color, border, opacity, and hover lift transitions; `ease-out` (`0.22s–0.48s`) for pointer-reactive shadows and date-range refreshes; `ease-in` (`0.16s`) for popover exit animations.

---

## 2. Pointer-Reactive Lighting (`MouseReactiveShadows`)

Implemented in [src/components/mouse-reactive-shadows.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/mouse-reactive-shadows.tsx) and styled at [globals.css:337, 357-358, 377-380](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L337):

1. **Interactive Target Selector:**
   ```css
   .login-form-wrap input, .search-box, .global-search, .global-date-filter,
   .stat-card, .fleet-card, .report-card, .settings-card
   ```
2. **Coordinate Calculation:**
   - Active only when `(hover: hover) and (pointer: fine)` matches and `(prefers-reduced-motion: reduce)` does **not** match.
   - On `pointermove`, calculates the cursor's normalized offset from the target element's bounding-box center, clamping `--mouse-shadow-x` and `--mouse-shadow-y` to **`[-8.0px, 8.0px]`** (updating via `requestAnimationFrame` only when delta `>= 0.25px`).
   - On `pointerout`, `blur`, `visibilitychange`, or during a `720ms` `.route-transition-active` window after route changes, resets `--mouse-shadow-x: 0px` and `--mouse-shadow-y: 2px`.
3. **Surface vs. Recessed Shadow Response:**
   - **Raised Cards & Filters (`.global-date-filter:hover`, `.stat-card:hover`, `.fleet-card:hover`, `.report-card:hover`, `.settings-card:hover`):** Cast an outer directional shadow using `var(--mouse-shadow-x) var(--mouse-shadow-y) 18px rgba(148, 158, 173, .24)` balanced by an opposing highlight `calc(var(--mouse-shadow-x) * -0.7) calc(var(--mouse-shadow-y) * -0.7) 12px rgba(255, 255, 255, .7)`.
   - **Recessed Inputs (`.login-form-wrap input:hover`, `.search-box:hover`):** Cast an **inset** directional shadow (`inset var(--mouse-shadow-x) var(--mouse-shadow-y) 10px ...`) without translating the element (`transform: none !important`).

---

## 3. Hover, Active & Press Feedback

| Element / Selector | Hover Behavior (`:hover`) | Active / Press Behavior (`:active`) |
| :--- | :--- | :--- |
| **Toolbar & Utility Buttons** (`.secondary-button`, `.export-button`, `.filter-button`, `.help-button`, `.pagination button`, `.theme-toggle`, `.report-print-button`) | `transform: translateY(-1px)` (`200ms ease`) | `transform: translateY(0)`; `.secondary-button`, `.export-button`, `.filter-button`, `.pagination button` switch `box-shadow` to `var(--shadow-inset)` |
| **KPI Summary Cards** (`.stat-card`) | `transform: translateY(-2px)`; `background-position: 100% 42%`; `::after` pseudo-element fades in (`opacity: 1`) running `card-border-glow` (`2.8s ease-in-out infinite` pulsing amber inset border and outer glow) | Remains elevated |
| **Owned Fleet Cards** (`.fleet-card`) | `transform: translateY(-4px)`; `::after` pseudo-element runs `fleet-card-highlight` (`2.2s ease-in-out infinite` pulsing `1px→2px` amber inset ring); `.fleet-card-detail-link b` shifts `translateX(3px)` | Standard link activation |
| **Truck Neighbor Cards** (`.truck-profile-neighbor`) | `transform: translateY(-3px)`; border tints toward `--color-accent`; shadow deepens to `--glass-shadow-strong`; arrow `i` shifts `translateX(3px)` | Standard link activation |
| **Sidebar Navigation Links** (`.sidebar nav .nav-item`) | `transform: translateX(3px)`; left `2px` amber indicator bar (`::before`) scales from `scaleY(.35)` to `scaleY(1)` (`opacity: 1`); `.icon` scales to `scale(1.08)` (disabled when `.sidebar.collapsed`) | Navigates and triggers `sidebar-active-in` |
| **Sidebar Collapse Toggle** (`.sidebar-collapse-toggle`) | Color deepens to `--color-accent-deep`; `.icon` scales to `scale(1.15)` with warm amber `text-shadow` glow | Toggles `collapsed` state |
| **Sidebar Footer Avatar** (`.sidebar-footer:hover .avatar`) | `transform: translateY(-2px) rotate(-3deg)`; `box-shadow: 0 5px 12px rgba(148, 158, 173, .2)` | Opens `AccountControl` menu |
| **Custom Select Options** (`.rounded-select-menu button`) | `background: rgba(245, 158, 11, .08); color: var(--color-accent-deep); transform: translateX(2px)` (`150ms ease`) | Selects option and closes menu |
| **Interactive Table Rows** (`.records-card tbody tr.record-row`) | Cell background tints to `color-mix(in srgb, var(--color-accent-soft) 46%, transparent)` (`250ms ease`) | Opens `RecordDetailDrawer` |
| **Drawer Close Button** (`.record-detail-close`) | `color: var(--color-accent); background: var(--color-accent-soft); transform: rotate(90deg)` (`200ms ease`) | Closes `RecordDetailDrawer` |

---

## 4. Focus Ring Conventions

All interactive elements use a high-visibility `3px solid var(--color-focus)` (`#f59e0b` in light mode, `#ffd166` in dark mode) outline on `:focus-visible`:

- **Default Global Rule ([globals.css:27](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L27)):**
  ```css
  button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
    outline: 3px solid var(--color-focus);
    outline-offset: 2px;
  }
  ```
- **Context-Specific Focus Offsets:**
  - `outline-offset: 3px`: `.primary-button`, `.report-print-button`, `.fleet-card-link`, `.truck-profile-neighbor`.
  - `outline-offset: -3px` (inset outline so overflow containers do not clip the ring): `.records-card tbody tr.record-row:focus-visible`, `.dashboard-attention .attention-link:focus-visible`, `.top-truck-link:focus-visible`.
  - `outline: 2px solid var(--color-focus); outline-offset: 2px`: `.sortable-table-header:focus-visible`, `.truck-profile-editor select:focus-visible`.
  - **Custom Non-Outline Focus Indicators:** `.date-picker-grid button:focus-visible` and `.date-picker-months button:focus-visible` suppress the default outline and apply `background: var(--color-accent-soft); color: var(--color-accent-deep)`. SVG `.chart-point:focus-visible` enlarges the point radius (`r: 6; stroke-width: 3`) with an amber drop-shadow and displays `.chart-point-tooltip`.

---

## 5. Popover, Dropdown, Drawer & Chart Choreography

### 5.1 Custom Select (`RoundedSelect`)
- **Open:** Renders `.rounded-select-menu` with `dropdown-pop` (`160ms cubic-bezier(.22, 1, .36, 1)`, `opacity: 0 → 1`, `translateY(-5px) scale(.98) → translateY(0) scale(1)`).
- **Close:** Sets `closing = true` for `EXIT_DURATION_MS = 160` ([rounded-select.tsx:13](file:///c:/Users/suchi/Documents/rrli/src/components/rounded-select.tsx#L13)), playing `dropdown-pop-out` (`160ms ease-in forwards`, `pointer-events: none`) before unmounting.
- **Dismissal:** Closes automatically on outside `pointerdown` or `Escape` keydown.

### 5.2 Global Date-Range Picker (`GlobalDateRangePicker`)
- **Open:** Plays `date-picker-open` (`200ms cubic-bezier(.22, 1, .36, 1)`, `translateY(-7px) scale(.985) → translateY(0) scale(1)`). On open, a `requestAnimationFrame` callback moves keyboard focus to `.date-picker-grid button.selected` (or the dialog container).
- **Two-Click Selection:** First date click sets `draftStart` and clears `draftEnd` (displaying `"Select an end date"`). Second date click orders `[startDate, endDate]` chronologically, commits `setRange`, closes the popover, and restores focus to `triggerRef`.
- **Dismissal:** Outside `mousedown` closes the popover; `Escape` closes the popover and returns focus to `triggerRef`.

### 5.3 Record Detail Drawer (`RecordDetailDrawer`)
- **Open:** Adds `record-detail-open` to `document.body`, which sets `--record-detail-reserved: var(--record-detail-width)` (`400px` / `360px`).
  - `.main-content` interpolates its `width` and `flex-basis` over `360ms cubic-bezier(.22, 1, .36, 1)`.
  - `.record-detail-drawer` enters via `detail-drawer-in` (`320ms cubic-bezier(.22, 1, .36, 1) both`, `opacity: .35 → 1`, `translateX(28px) → translateX(0)`).
  - Focus moves via `requestAnimationFrame` to `.record-detail-close`.
- **Dismissal:** Clicking `.record-detail-close` or pressing `Escape` clears the selected record and removes `body.record-detail-open`.

### 5.4 Continuous SVG Chart Scrubbing (`RevenueChart`)
- Implemented in [src/app/dashboard/page.tsx](file:///c:/Users/suchi/Documents/rrli/src/app/dashboard/page.tsx#L78-L90):
  - Moving the pointer anywhere across the `<svg className="revenue-chart">` triggers `onPointerMove`, which maps `event.clientX` into the SVG's `720px` viewBox coordinate space and selects the closest data point horizontally (`selectClosestPoint`).
  - As the user scrubs horizontally across the chart, the active point highlight and `.chart-point-tooltip` transition smoothly from point to point without flickering or disappearing until `onPointerLeave`.

---

## 6. Page Transitions & Staggered Entry Cascades

| Animation Name | Duration & Easing | Trigger & Visual Effect |
| :--- | :--- | :--- |
| **`route-content-in`** | `560ms cubic-bezier(.22, 1, .36, 1) backwards` | Applied to `.route-template .main-content > .content-wrap` on route navigation (`opacity: .35 → 1`, `translateY(8px) scale(.998) → 0`). |
| **`heading-gradient-shift`** | `9s ease-in-out infinite alternate` | Continuous ambient background-position shift (`0% → 50% → 100%`) on `.page-intro h1` (`8s` on `.dashboard-welcome h1`). |
| **`dashboard-element-in`** | `520ms cubic-bezier(.22, 1, .36, 1) backwards` | Staggered entry cascade across Dashboard sections (`delays: .07s` welcome, `.13s–.28s` stat cards, `.31s` insights, `.33s–.51s` columns & rows, `.54s` scope note). |
| **`dashboard-range-refresh`** | `220ms ease-out` container + `340ms–500ms` child stagger | Triggered when `rangeKey` (`formatDateRange(range)`) changes on Dashboard; animates `.revenue-chart` via `dashboard-chart-refresh` (`scaleY(.98) → scaleY(1)` from bottom origin). |
| **`fleet-card-in` & `table-row-in`** | `550ms` (cards, `60ms` stagger) / `420ms` (rows, `40ms` stagger) | Staggered vertical (`translateY(14px)`) and horizontal (`translateX(-6px)`) entry for fleet cards and table rows. |
| **`login-surface-in` & `login-surface-out`** | `550ms` entry / `420ms` exit (`SIGN_IN_TRANSITION_MS = 480`) | Blurs (`3px → 0`) and scales (`.995 → 1`) the login split panels on load and reverses when `.login-exiting` is applied before route redirect. |
| **View Transitions** (`route-heading`, `active-sidebar-item`) | `650ms` (`route-heading`) / `550ms` (`active-sidebar-item`) | Named CSS View Transition groups (root page view transition is disabled via `@view-transition { navigation: none }` and `::view-transition-group(root) { animation: none !important }`). |

---

## 7. Reduced-Motion & Keyboard Accessibility

1. **Global Reduced-Motion Override ([globals.css:418](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L418)):**
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: .01ms !important;
       animation-iteration-count: 1 !important;
       scroll-behavior: auto !important;
       transition-duration: .01ms !important;
     }
   }
   ```
   In addition, JavaScript checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches` in [`LoginPage`](file:///c:/Users/suchi/Documents/rrli/src/app/login/page.tsx#L30) (skipping the `480ms` exit delay) and [`MouseReactiveShadows`](file:///c:/Users/suchi/Documents/rrli/src/components/mouse-reactive-shadows.tsx#L38) (skipping pointer-tracking listeners).
2. **Keyboard Row Activation:** Selectable table rows (`tr.record-row`) carry `tabIndex={0}`, `role="button"`, `aria-label`, and an `onKeyDown` handler that activates the row on `Enter` or `Space` (`event.preventDefault()`).
3. **Preventing Initial Sidebar Layout Jump:** On route changes, [`MouseReactiveShadows`](file:///c:/Users/suchi/Documents/rrli/src/components/mouse-reactive-shadows.tsx#L25-L27) removes `.sidebar-ready` for two animation frames so `.sidebar:not(.sidebar-ready)` suppresses unintended initial width transitions on mount.

