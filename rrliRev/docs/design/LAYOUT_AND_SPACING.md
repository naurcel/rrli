# RouteX Layout and Spacing

**Document Role:** Structural specification for the application shell, sidebar dimensions, main content viewport, page padding rhythm, grid systems, and responsive breakpoints.  
**Related Documents:** [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) · [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) · [COMPONENT_DESIGN.md](./COMPONENT_DESIGN.md) · [INTERACTION_AND_MOTION.md](./INTERACTION_AND_MOTION.md)

---

## 1. Application Shell & Viewport Architecture

RouteX uses a **fixed-viewport workspace shell** ([globals.css:24-25, 41, 61, 677-686](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L24-L41)):

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ html / body (height: 100%, min-width: 320px, overflow: hidden)               │
│ ┌──────────────┬───────────────────────────────────────┬───────────────────┐ │
│ │ .sidebar     │ .main-content (height: 100vh,         │ .record-detail-   │ │
│ │ (sticky,     │  overflow-y: auto, overflow-x: hidden)│  layer (fixed,    │ │
│ │  100vh)      ├───────────────────────────────────────┤  400px / 360px    │ │
│ │              │ .topbar (height: 72px)                │  when open)       │ │
│ │ 248px exp.   ├───────────────────────────────────────┤                   │ │
│ │  84px coll.  │ .content-wrap                         │                   │ │
│ │  66px mobile │ (padding: 40px 72px 46px)             │                   │ │
│ │              │   ├─ .page-intro                      │                   │ │
│ │              │   ├─ .notice (optional)               │                   │ │
│ │              │   ├─ .stat-grid / .dashboard-stats    │                   │ │
│ │              │   ├─ .records-card / .fleet-section   │                   │ │
│ │              │   └─ .scope-note                      │                   │ │
│ └──────────────┴───────────────────────────────────────┴───────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Outer Shell Rules
- **`html` & `body`:** `height: 100%; overflow: hidden; min-width: 320px; margin: 0; background: var(--color-page)`.
- **`.app-shell`:** `display: flex; height: 100vh; min-height: 0; overflow: hidden`.

---

## 2. Sidebar Dimensions & States

Implemented in [`OperationalSidebar`](file:///c:/Users/suchi/Documents/rrli/src/components/operational-sidebar.tsx) and [`SidebarStateProvider`](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state.tsx):

| State / Viewport | Width & Flex Basis | Padding & Brand Area | Navigation Item Layout |
| :--- | :--- | :--- | :--- |
| **Expanded (Default)** | `248px` (`--sidebar-width: 248px`, `--operational-sidebar-width: 248px`) | `padding: 20px 12px 14px`; `.sidebar-brand-space` height `72px`, margin `0 6px 8px` (displays `88px` full logo) | `.nav-item`: `min-height: 38px`, `padding: 11px 13px 11px 16px`, `gap: 12px`, left-aligned icon + `.nav-label` |
| **Collapsed (User Toggled)** | `84px` (`COLLAPSED_WIDTH = 84` in [sidebar-state.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state.tsx#L7)) | `.sidebar.collapsed .sidebar-brand-space` height `70px`, `margin-bottom: 4px` (displays `31px` symbol mark) | `.nav-item`: centered (`justify-content: center; padding-inline: 0; gap: 0`); `.nav-label` collapses to `max-width: 0; opacity: 0` |
| **Medium Viewport (`<= 900px`)** | `210px` (`width: 210px; flex-basis: 210px` at [globals.css:441](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L441)) | Inherits expanded padding | Standard expanded item layout |
| **Compact Viewport (`<= 700px`)** | `66px` (`width: 66px; flex-basis: 66px; padding-inline: 9px` at [globals.css:442](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L442)) | Switches brand space to symbol mark (`::after { opacity: 1 }`) | Icon-only rail (`justify-content: center; padding: 12px 0; font-size: 0; .icon { font-size: 18px }`) |

> **Note on Legacy Resize Handle CSS:** Lines 64–65 and 81–84 of `globals.css` still contain `.sidebar-resize-handle` styles from an earlier drag-to-resize iteration, alongside [src/components/sidebar-state-model.ts](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state-model.ts). In the active UI, `.sidebar-resize-handle` is hidden (`display: none` at line 359) in favor of the explicit two-state `.sidebar-collapse-toggle` button (`30px × 30px`, positioned at `top: 24px; right: 15px` when expanded and `top: 24px; right: 7px` when collapsed).

### 2.1 Internal Sidebar Vertical Spacing
- **Primary Navigation (`nav`):** `display: flex; flex-direction: column; gap: 2px` (`.sidebar.collapsed nav` adds `margin-top: 8px`).
- **Management Navigation (`.management-navigation`):** `margin-top: 24px` separating Administration, Human resources, and Settings from the 5 operational routes.
- **Sidebar Footer (`.sidebar-footer`):** `margin-top: auto; padding: 12px 8px 0; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 10px`.

---

## 3. Main Content Area, Topbar & Detail Column Reservation

### 3.1 Main Content Viewport (`.main-content`)
- Scrolls vertically independently of the sidebar: `height: 100vh; overflow-x: hidden; overflow-y: auto; min-width: 0`.
- **Dynamic Width Reservation ([globals.css:677-680](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L677-L680)):**
  ```css
  :root { --record-detail-reserved: 0px; }
  .main-content {
    flex: 0 0 calc(100vw - var(--operational-sidebar-width, var(--sidebar-width)) - var(--record-detail-reserved));
    width: calc(100vw - var(--operational-sidebar-width, var(--sidebar-width)) - var(--record-detail-reserved));
    transition: flex-basis .36s cubic-bezier(.22, 1, .36, 1), width .36s cubic-bezier(.22, 1, .36, 1);
  }
  body.record-detail-open { --record-detail-reserved: var(--record-detail-width); }
  ```
- At `<= 760px`, `.main-content` reverts to `flex: 1 1 auto; width: auto; transition: none`, allowing the detail drawer (`width: min(100%, 360px)`) to overlay the right edge on narrow screens.

### 3.2 Topbar Dimensions (`.topbar`)
- **Desktop (`> 900px`):** `height: 72px; padding: 0 42px; display: flex; align-items: center; justify-content: flex-start`.
  - `.topbar-primary`: `display: flex; align-items: center; gap: 26px`.
  - `.topbar-actions`: `margin-left: auto; display: flex; align-items: center; gap: 18px`.
- **Tablet (`<= 900px`):** `padding: 0 25px; .topbar-primary { gap: 14px }`.
- **Mobile (`<= 700px`):** `height: 60px; padding: 0 16px`. The date filter slot (`.topbar-filter-slot` / `.global-date-picker`), `.preview-pill`, and `.help-button` hide (`display: none`), leaving `.theme-toggle` aligned right (`margin-left: auto`).

### 3.3 Content Wrapper & Page Padding (`.content-wrap`)
Although line 49 of `globals.css` initially declared `width: min(1250px, calc(100% - 84px)); margin: 0 auto; padding: 40px 0 46px`, later rules at lines 234–238 and 684 establish the **effective layout convention**:
- **Desktop (`> 900px`):** `width: 100%; max-width: none; margin: 0; padding: 40px 72px 46px; box-sizing: border-box`.
  - *Exception:* `/hr` adds `.hr-page { max-width: 1240px }` ([globals.css:640](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L640)).
  - *When Detail Drawer Is Open (`body.record-detail-open .content-wrap`):* Right padding tightens from `72px` to `30px` (`width: 100%; padding-right: 30px` at line 684) so tables and grids utilize the remaining workspace width cleanly.
- **Tablet (`<= 900px`):** `padding-inline: 38px`.
- **Mobile (`<= 700px`):** `padding-top: 28px; padding-inline: 20px`.

---

## 4. Section Spacing & Vertical Rhythm

Standard operational pages follow a predictable top-to-bottom vertical spacing rhythm:

| Element / Transition | Vertical Margin / Padding | Source in `globals.css` |
| :--- | :--- | :--- |
| **Back Link (`.back-link`)** (Detail/Create pages) | `min-height: 32px; margin-bottom: 18px` (page `.fleet-detail-page` uses `padding-top: 32px`) | Line 502 |
| **Page Header (`.page-intro`)** | `display: flex; align-items: end; justify-content: space-between; gap: 24px` (`.subtitle` has `margin-top: 13px`) | Line 49 |
| **Informational Banner (`.notice`)** | `margin-top: 28px; padding: 13px 15px` (`.report-notice` adds `margin-bottom: 26px`; `.audit-notice` uses `margin: 0 0 16px`) | Lines 50, 510, 519 |
| **KPI Summary Grid (`.stat-grid`)** | `margin: 22px 0; gap: 15px` (`.stat-card` padding `20px 21px 18px`; `15px 17px` on mobile) | Lines 51, 442 |
| **Dashboard Insights / Attention** | `margin: 16px 0; gap: 16px` (`.dashboard-attention` uses `margin: 0 0 16px`) | Lines 476, 491 |
| **Records Card Header (`.records-heading`)** | `padding: 22px 23px 18px` (`padding-inline: 14px` at `<= 700px`) | Lines 52, 442 |
| **Filter Toolbar (`.filters`)** | `padding: 0 23px 17px; gap: 9px; border-bottom: 1px solid var(--line)` (`padding-inline: 14px` at `<= 700px`) | Lines 52, 442 |
| **Table Cells (`th` / `td`)** | `th`: `padding: 12px 14px`; `td`: `padding: 16px 14px`; first/last child inline padding `23px` (`14px` at `<= 700px`) | Lines 53, 442 |
| **Table Footer (`.table-footer`)** | `padding: 15px 23px` (`padding-inline: 14px` at `<= 700px`) | Lines 53, 442 |
| **Secondary Page Sections** | `.fleet-section`: `margin-top: 78px` (`35px` at `<= 760px`); `.fleet-subcontracted`: `margin-top: 30px`; `.administration-audit`: `margin-top: 38px` | Lines 148, 168, 174, 510 |
| **Footer Scope Note (`.scope-note`)** | `margin: 17px 2px 0` | Line 53 |

---

## 5. Grid & Column Conventions

| Grid Class | Desktop Columns | Gap | Responsive Adaptation |
| :--- | :--- | :---: | :--- |
| **`.stat-grid`** (Deliveries, Transactions) | `repeat(3, 1fr)` | `15px` | `1fr` at `<= 700px` |
| **`.dashboard-stats`** (Dashboard) | `repeat(4, 1fr)` | `15px` | `repeat(2, 1fr)` at `<= 1000px`; `1fr` at `<= 700px` |
| **`.hr-status-grid`** (HR Overview) | `repeat(4, minmax(0, 1fr))` | `14px` | Inherits `.stat-card` sizing (`min-height: 138px`) |
| **`.dashboard-insights`** (Chart + Top Trucks) | `minmax(0, 1.6fr) minmax(290px, .8fr)` | `16px` | `1fr` at `<= 1000px`; `gap: 12px` at `<= 700px` |
| **`.dashboard-columns`** (Recent + Quick Actions) | `minmax(0, 1.5fr) minmax(260px, .8fr)` | `16px` | `1fr` at `<= 1000px` |
| **`.attention-grid` & `.hr-rules-grid`** | `repeat(3, minmax(0, 1fr))` | `0` (divided by `1px` hairlines) | Stacks vertically at `<= 1000px` |
| **`.fleet-card-grid`** (Owned Fleet Cards) | `repeat(4, minmax(0, 1fr))` | `22px` | `repeat(3, ...)` at `<= 1100px`; `repeat(2, ...)` at `<= 760px` |
| **`.truck-profile-hero`** (Photo + Details + KPIs) | `minmax(230px, .9fr) minmax(280px, 1fr) minmax(250px, .9fr)` | `16px` | 2-col (`minmax(230px, .8fr) minmax(280px, 1fr)`) with full-width 5-col KPI bar at `<= 1080px`; `1fr` at `<= 700px` |
| **`.preview-create-grid`** (Paired Form Inputs) | `repeat(2, minmax(0, 1fr))` | `18px` | `1fr` at `<= 700px` |
| **`.report-summary`** (Report Document Header KPIs) | `repeat(4, minmax(0, 1fr))` | `16px` | `repeat(2, minmax(0, 1fr)); gap: 18px` at `<= 760px` |
| **`.login-page`** (Split Authentication Layout) | `minmax(0, 50%) minmax(0, 50%)` | `0` (`padding: 8px`) | `1fr` (`42svh` visual top / `58svh` form bottom) at `<= 760px` |

---

## 6. Consolidated Responsive Breakpoint Reference

RouteX uses **8 max-width media query breakpoints** in [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css). Notice that both `760px` and `700px` (and `1100px` / `1080px` / `1000px`) are used across different component groups:

| Breakpoint | Key Layout Adaptations |
| :--- | :--- |
| **`<= 1100px`** | `.fleet-card-grid` drops from 4 columns to 3 columns. |
| **`<= 1080px`** | `--record-detail-width` narrows from `400px` to `360px`; `.truck-profile-hero` drops to 2 columns with `.truck-performance-kpis` expanding to a 5-column horizontal strip across the bottom. |
| **`<= 1000px`** | `.dashboard-stats` drops from 4 columns to 2×2; `.dashboard-insights` and `.dashboard-columns` stack to 1 column; `.quick-action-list` becomes a 2-column grid; `.dashboard-attention` items stack with horizontal bottom borders. |
| **`<= 900px`** | `.sidebar` narrows to `210px`; `.topbar` padding reduces to `0 25px`; `.content-wrap` inline padding reduces from `72px` to `38px`; `.global-date-filter` min-width reduces from `214px` to `190px`; `.settings-grid` stacks to 1 column. |
| **`<= 760px`** | `.fleet-card-grid` drops to 2 columns; `.login-page` stacks vertically; `.report-summary` becomes 2×2; `.main-content` stops reserving horizontal width when the detail drawer opens. |
| **`<= 700px`** | `.sidebar` collapses to a `66px` icon-only rail; `.topbar` height drops to `60px` (`padding: 0 16px`) and hides the date filter, preview pill, and help button; `.content-wrap` inline padding drops to `20px`; `.stat-grid` and `.preview-create-grid` stack to 1 column; `.page-intro .secondary-button` hides; table and card inline paddings tighten to `14px`. |
| **`<= 520px`** | `.fallback-panel` and `.login-card` reduce padding to `32px 22px` / `28px 22px`; `.fallback-actions` stack full-width. |
| **`<= 460px`** | `.subcontracted-filters .rounded-select` and `.subcontractor-provider-filter` expand to `width: 100%`. |

> **Recommendation for Future CSS Additions:** Standardize new responsive rules on three primary breakpoints—**`1080px`** (compact desktop / tablet landscape), **`900px`** (tablet portrait), and **`700px`** (mobile)—rather than introducing additional intermediate pixel thresholds.

