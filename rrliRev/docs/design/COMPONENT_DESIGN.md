# RouteX Component Design

**Document Role:** Structural markup, visual specifications, sizing, and variants for all reusable UI components in RouteX.  
**Related Documents:** [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) · [LAYOUT_AND_SPACING.md](./LAYOUT_AND_SPACING.md) · [INTERACTION_AND_MOTION.md](./INTERACTION_AND_MOTION.md) · [UI_STATES_AND_FEEDBACK.md](./UI_STATES_AND_FEEDBACK.md)

---

## 1. Buttons & Action Controls

RouteX uses distinct button classes depending on whether an action is a primary form submission, a page-level secondary action, a toolbar filter, or an inline utility control:

| Button Class | Height & Padding | Radius & Surface | Typography | Primary Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`.primary-button`** ([globals.css:636](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L636)) | `min-height: 40px`, `padding: 0 14px`, `gap: 8px` | `border-radius: 12px`; `border: 0`; `background: var(--color-accent)` (`--color-accent-deep` on hover); `box-shadow: 0 7px 15px rgba(180, 83, 9, .2)` | `11px`, `font-weight: 700`, `#fff` | Primary submit/continue button in creation forms (`/deliveries/new`, `/fleet/new`, `/transactions/new`). |
| **`.report-print-button`** ([globals.css:519](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L519)) | `min-height: 42px`, `padding: 0 16px`, `gap: 7px` | `border-radius: 13px`; `background: var(--color-accent-highlight)` (`--color-accent-deep` on hover); `box-shadow: 0 8px 18px rgba(180, 83, 9, .22)` | `12px`, `font-weight: 700`, `#fff` | Primary print/PDF action in `.report-actions`. |
| **`.secondary-button`** ([globals.css:49, 111, 427](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L49)) | `padding: 10px 13px`, `gap: 9px` | `border-radius: 8px`; `border: 1px solid var(--glass-border)`; `background: var(--glass-surface-strong)`; neumorphic glass shadow | `12px`, `#5c6d66` (`var(--color-text-secondary)` in dark mode) | Top-right `.page-intro` actions (`Add delivery`, `Add vehicle`, `Add transaction`, `Invite member`, `Edit truck details`). |
| **`.filter-button`** ([globals.css:49, 52, 663](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L49)) | `min-height: 42px` inside `.more-filters-control` (`40px` in form Cancel actions), `padding: 0 14px` | `border-radius: 14px` in `.more-filters-control` (`8px` base); `background: var(--glass-surface-strong)` | `12px`, `var(--color-text-secondary)` (`.filter-clear` uses `var(--color-accent-deep)`) | Toolbar `More filters` disclosure, `Clear filters`, and form `Cancel` / `Back` actions. |
| **`.export-button`** ([globals.css:49, 52](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L49)) | `padding: 10px 13px`, `gap: 9px` | `border-radius: 8px`; `background: var(--glass-surface-strong)` | `12px`, `#6d7b75` with `.lock` (`#a8b2ae`) | Card-header `Export` button (currently rendered `disabled` with `<span className="lock">◌</span>`). |
| **`.truck-photo-button`** ([globals.css:563](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L563)) | `min-height: 31px`, `padding: 0 10px` | `border-radius: 9px`; `--glass-surface-strong` (`--shadow-soft`) | `10px`, `font-weight: 700` | Compact media actions (`Add photo` / `Apply crop` use `.truck-photo-button-primary`; `Remove` uses `.truck-photo-button-danger` `#a83a2f`). |
| **`.help-button` & `.theme-toggle`** ([globals.css:48, 446](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L48)) | `.help-button`: `22px × 22px`; `.theme-toggle`: `30px × 30px` | `border-radius: 50%`; `1px solid var(--glass-border)`; `--glass-surface-strong` | `.help-button`: `font-weight: 700`; `.theme-toggle`: `16px × 16px` stroke SVG | Circular topbar utility buttons (`.theme-toggle-floating` positions absolute `top: 20px; right: 20px` on `/login` and fallback pages). |
| **`.fallback-action` & `.fallback-link`** ([globals.css:35-37](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L35-L37)) | `min-height: 42px`, `padding: 0 16px` | `border-radius: var(--radius-control)` (`7px`); `.fallback-action` uses `linear-gradient(105deg, var(--color-accent-deep), var(--color-accent))` | `14px`, `font-weight: 700` | Error boundary (`src/app/error.tsx`) recovery actions. |

---

## 2. Inputs, Text Fields & Form Steppers

### 2.1 Standard Workspace Form Fields (`.preview-create-form`, `.truck-create-form`)
Implemented in [globals.css:627-639](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L627-L639):
- **Form Card Container (`.preview-create-card`, `.truck-create-card`):** `width: min(100%, 590px); margin-top: 30px`.
- **Form Grid (`.preview-create-form`, `.truck-create-form`):** `display: grid; gap: 18px; padding: 0 23px 23px` (`padding-inline: 14px` at `<= 700px`).
- **Labels:** `display: grid; gap: 8px; color: var(--color-text-secondary); font-size: 11px; font-weight: 700`.
- **Text / Number / Date Inputs:**
  - `min-height: 43px; padding: 0 14px; border: 1px solid var(--glass-border); border-radius: 13px; background: var(--glass-surface-strong); box-shadow: var(--shadow-inset); color: var(--color-text-primary); font-size: 13px`.
  - In dark mode (`html[data-theme="dark"]`): `background: rgba(17, 23, 30, .7)`.
  - On `:focus`: `border-color: color-mix(in srgb, var(--color-accent) 58%, var(--glass-border))` plus global `:focus-visible` ring.
- **Paired Field Row (`.preview-create-grid`):** `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px` (`1fr` at `<= 700px`), forcing child `input` and `.rounded-select` controls to `width: 100%; min-width: 0`.
- **Multi-Step Progress Indicator (`.delivery-stepper`):**
  - `display: flex; align-items: center; gap: 8px; padding: 0 23px 20px`.
  - Step circles (`span`): `23px × 23px`, `border-radius: 999px`, `1px solid var(--glass-border)`, `font-size: 11px; font-weight: 800`. Active steps (`span.active`) use `border-color: color-mix(in srgb, var(--color-accent) 55%, var(--glass-border))`, `background: color-mix(in srgb, var(--color-accent) 14%, var(--glass-surface-strong))`, `color: var(--color-accent-deep)`.
  - Connector lines (`i`): `width: 32px; height: 1px; background: var(--glass-border)`.
- **File Attachment Dropzone (`.pod-attachment`):**
  - `padding: 13px; border: 1px dashed color-mix(in srgb, var(--color-accent) 37%, var(--glass-border)); border-radius: 13px; background: color-mix(in srgb, var(--glass-surface-strong) 88%, transparent)`.
  - Trigger pill (`.pod-attachment-trigger`): `min-height: 36px; padding: 0 12px; border-radius: 10px; font-size: 11px; font-weight: 750; color: var(--color-accent-deep)`.

### 2.2 Login Form Fields (`.login-form-wrap`)
The split-screen `/login` page uses slightly more compact input geometry ([globals.css:266, 311-315, 458](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L311-L315)):
- Wrapper width: `width: min(100%, 380px)`.
- Labels: `gap: 7px; font-size: 11px; font-weight: 600; color: #506276` (`var(--color-text-secondary)` in dark mode).
- Inputs (`email`, `password`, `text`): `min-height: 40px; padding: 0 14px 0 16px; border-radius: 14px; font-size: 11px; background: rgba(224, 233, 241, .78)` (`rgba(17, 23, 30, .48)` in dark mode) with `--shadow-inset`.

---

## 3. Selects, Dropdowns & Filter Disclosures

### 3.1 Custom Select (`RoundedSelect` — [src/components/rounded-select.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/rounded-select.tsx))
Used across all toolbars and creation forms in place of native `<select>` elements (note: only the inline `.truck-profile-editor` on `/fleet/[truckId]` still uses a native `<select>`):
- **Container (`.rounded-select`):** `position: relative; z-index: 4; flex: 0 0 165px; min-width: 0` (`z-index: 50` when `.is-open`, while parent `.records-card:has(.rounded-select.is-open)` elevates to `z-index: 20; overflow: visible` so menus are never clipped by card bounds).
- **Trigger Button (`.rounded-select-trigger`):**
  - `min-height: 42px; width: 100%; padding: 0 14px; gap: 12px; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--glass-surface-strong); box-shadow: var(--shadow-soft); color: var(--color-text-secondary); font-size: 12px`.
  - Right chevron (`.dropdown-chevron`): `7px × 7px` CSS border chevron rotated `45deg` (`225deg` when `[aria-expanded="true"]`).
- **Listbox Menu (`.rounded-select-menu`):**
  - `position: absolute; z-index: 30; top: calc(100% + 7px); left: 0; right: 0; padding: 6px; border: 1px solid var(--glass-border); border-radius: 14px; background: rgba(255, 255, 255, .94)` (`rgba(28, 37, 47, .98)` in dark mode); `box-shadow: var(--glass-shadow-strong); backdrop-filter: blur(16px)`.
  - Option buttons (`role="option"`): `padding: 9px 10px; border-radius: 9px; font-size: 12px; color: var(--color-text-secondary)`.
  - Selected option (`.selected`): `background: var(--color-accent-soft); color: var(--color-accent-deep); font-weight: 700`.

### 3.2 Secondary Filter Popover (`.more-filters-control` & `.more-filters-popover`)
Implemented at [globals.css:662-664](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L662-L664) and used in `/deliveries`, `/fleet`, `/transactions`, and `AuditTrailPreview`:
- **Container (`.more-filters-control`):** `position: relative; z-index: 8; flex: 0 0 165px`.
- **Popover Panel (`.more-filters-popover`):**
  - `position: absolute; z-index: 35; top: calc(100% + 8px); right: 0; width: min(290px, calc(100vw - 36px)); display: grid; gap: 8px; padding: 12px; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--glass-surface-strong); box-shadow: var(--glass-shadow-strong); backdrop-filter: blur(16px)`.
  - Header label (`> span`, e.g., `"Refine by"`): `font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-muted)`.
  - Child `.rounded-select` controls expand to `width: 100%` with `.rounded-select-menu { z-index: 45 }`.

---

## 4. Search Fields (`.search-box`)

Placed as the first child of `.filters` toolbars ([globals.css:52, 100, 112, 428, 458](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L52)):
- **Container (`label.search-box`):** `display: flex; align-items: center; flex: 1; max-width: 450px; gap: 9px; padding: 9px 12px; border: 1px solid var(--glass-border); border-radius: 7px; background: rgba(255, 255, 255, .52)` (`rgba(17, 23, 30, .48)` in dark mode); `box-shadow: inset 4px 4px 9px rgba(148, 158, 173, .2), inset -4px -4px 9px rgba(255, 255, 255, .88)` (`var(--shadow-inset)` in dark mode).
- **Search Input (`input`):** `width: 100%; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 12px` with placeholder `#a6b0ac` (`#80909c` in dark mode).
- At `<= 700px`, `.search-box` expands to `min-width: 100%`.

---

## 5. Tables & Input-Based Pagination

### 5.1 Tables & Sortable Column Headers
All data tables live inside a `.records-card` container ([globals.css](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/globals.css)):
- **Scroll Wrapper (`.table-wrap`):** `width: 100%; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scrollbar-color: #c7cdd6 transparent` (`10px` custom webkit scrollbar thumb with hover accent color).
- **Table Element (`table`):** `width: 100%; border-collapse: collapse; min-width: 1100px` (`min-width: 680px; table-layout: fixed` inside `.dashboard-columns .table-wrap table`; `min-width: 560px` inside `.report-document table`).
  - Surface: `background: rgba(255, 255, 255, .82)` (`rgba(25, 33, 42, .86)` in dark mode); `border-radius: var(--radius-card)` (`10px`).
- **Column Headers (`th` & [`SortableTableHeader`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/sortable-table-header.tsx)):**
  - `th`: `padding: 12px 14px` (`padding-left: 23px` on `first-child`, `padding-right: 23px; text-align: right` on `last-child`); `background: transparent`; `color: #96a19c` (`var(--color-text-muted)` in dark mode); `font-size: 9px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase`.
  - `.sortable-table-header`: `display: inline-flex; align-items: center; gap: 5px; min-height: 26px; padding: 3px 1px; border: 0; background: transparent; cursor: pointer`.
  - Sort indicator (`b`): `width: 12px; font-size: 12px; color: var(--color-text-muted)` (`↕` neutral, `↑` `.asc`, `↓` `.desc` colored `var(--color-accent)`).
- **Table Rows & Cells (`tbody tr.record-row`, `td`):**
  - `td`: `padding: 16px 14px; border-top: 1px solid #edf1ee` (`var(--color-border-subtle)` in dark mode); `color: #586762` (`var(--color-text-secondary)` in dark mode); `font-size: 12px; white-space: nowrap`.
  - Specialized cell classes:
    - `.record-link`: `color: #277859; font-weight: 700` (underlines on hover).
    - `.truck-code`: `color: #66766f; font-variant-numeric: tabular-nums`.
    - `.money`: `color: var(--ink); font-weight: 700`.

### 5.2 Input-Based Page Number Pagination (`TablePagination` — [src/components/table-pagination.tsx](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/table-pagination.tsx))
Standardized across all application tables:
- **Container (`.table-footer` & `.pagination-container`):** `display: flex; align-items: center; justify-content: space-between; padding: 14px 23px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--color-text-muted)`.
- **Item Count Summary:** Displays `Showing X to Y of Z items` with grammatical singular/plural handling.
- **Direct Page Input Controls (`.pagination-controls` & `.pagination-input-wrap`):**
  - Previous / Next buttons: `min-height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass-surface-strong); font-size: 11.5px; font-weight: 600`.
  - Direct Page Number Input (`.pagination-page-input`): Compact numerical input field (`width: 44px; height: 28px; text-align: center; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid var(--glass-border)`).
  - Users can type any page number and press `Enter` or blur to jump directly to that page; values are automatically clamped between `1` and `pageCount`.
- **Page Size Limits by Surface:**
  - **Dashboard Recent Deliveries Table:** Strictly **5 records per page**.
  - **All Other Tables:** Strictly **10 records per page** (`/deliveries`, `/reports`, `/truck-profitability/[plate]`, `/pod-documents`, `/truck-profitability`, `/user-management`).

---

## 6. Cards & Surface Containers

| Card Class | Geometry & Padding | Surface & Elevation | Key Child Elements |
| :--- | :--- | :--- | :--- |
| **`.stat-card`** ([globals.css:51, 109, 115-116, 410-414, 425-426](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L51)) | `padding: 20px 21px 18px`; `border-radius: 10px` | `background: var(--glass-surface)` + `var(--glow-amber)` (`var(--glow-success)` on `:nth-child(2)`); `border: 1px solid rgba(255, 255, 255, .92)`; `box-shadow: var(--glass-shadow-strong)` | `.stat-label` (`10px` uppercase), `strong` (`25px` standard / `31px` in `.dashboard-stats`), `.stat-meta` (`11px`). |
| **`.records-card`** ([globals.css:52, 110, 117, 425-426](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L52)) | `border-radius: 10px`; `overflow: hidden` (`overflow: visible` when child `.rounded-select.is-open` is present) | `background: rgba(255, 255, 255, .84)` + `var(--glow-amber)` (`var(--glass-surface)` in dark mode); `border: 1px solid rgba(255, 255, 255, .92)`; `box-shadow: var(--glass-shadow-strong)` | `.records-heading`, `.filters`, `.table-wrap`, `.table-footer`. |
| **`.fleet-card`** ([globals.css:155-173](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L155-L173)) | `border-radius: 24px`; `overflow: hidden`; `.fleet-photo` height `177px`; `.fleet-card-body` padding `20px 22px 22px` | `background: rgba(255, 255, 255, .72)` (`var(--glass-surface)` in dark mode); `border: 1px solid #dce5ef`; soft neumorphic shadow | `.fleet-photo`, `.fleet-card-title` (`h2` + vehicle type `p` + `.fleet-status` pill), `dl` key-value rows, `.fleet-card-detail-link`. |
| **`.report-document`** ([globals.css:519](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L519)) | `width: min(100%, 840px)`; `border-radius: 20px`; header `36px 40px 24px`; summary `25px 40px 28px`; table section `0 40px 32px`; footer `16px 40px` | `background: color-mix(in srgb, var(--color-surface) 94%, white)`; `border: 1px solid var(--glass-border)`; `box-shadow: var(--glass-shadow-strong)` | `.report-document-header`, `.report-summary`, `.report-table-section`, `.report-document-footer` (optimized for `@media print`). |

---

## 7. Tabs & Segmented Controls

RouteX implements three segmented tab variations:
1. **Card Metric Tabs (`.metric-tabs` — [globals.css:486-487](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L486-L487)):**
   - Used inside Dashboard `Top trucks` (`Revenue`, `Net margin`, `Deliveries`).
   - Container: `display: flex; gap: 6px; padding: 0 20px 14px; border-bottom: 1px solid var(--line)`.
   - Pill buttons: `min-height: 29px; padding: 0 9px; border-radius: 999px; font-size: 10px; font-weight: 700; color: var(--color-text-muted)`. Active state (`.active`): `background: var(--color-accent-soft); color: var(--color-accent-deep); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-highlight) 20%, transparent)`.
2. **Centered Workspace Document Tabs (`.report-tabs` — [globals.css:519](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L519)):**
   - Used on `/reports` (`role="tablist"`).
   - Container: `display: inline-flex; gap: 3px; padding: 4px; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--glass-surface); box-shadow: var(--shadow-soft)`.
   - Tab buttons (`role="tab"`): `min-height: 33px; padding: 0 12px; border-radius: 10px; font-size: 11px; color: var(--color-text-secondary)`. Active state: `background: var(--glass-surface-strong); box-shadow: var(--shadow-soft); color: var(--color-text-primary); font-weight: 700`.
3. **Recessed Section Tabs (`.hr-tabs` — [globals.css:640](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L640)):**
   - Used on `/hr` (`Overview`, `Employees`, `Attendance`, `Payroll`).
   - Container: `display: flex; gap: 4px; width: fit-content; margin: 0 0 22px; padding: 4px; border-radius: 13px; background: color-mix(in srgb, var(--glass-surface-strong) 86%, transparent); box-shadow: var(--shadow-inset)`.
   - Tab buttons: `min-height: 34px; padding: 0 14px; border-radius: 9px; font-size: 12px; font-weight: 700`. Active state: `background: var(--glass-surface-strong); color: var(--color-text-primary); box-shadow: var(--shadow-soft)`.

---

## 8. Complementary Drawers, Popovers & Tooltips

### 8.1 Record Detail Drawer ([src/components/record-detail-drawer.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/record-detail-drawer.tsx), [globals.css:501, 525-534, 568](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L501))
- **Outer Layer (`.record-detail-layer`):** `position: fixed; z-index: 80; top: 0; right: 0; bottom: 0; left: auto; width: var(--record-detail-width)` (`400px` desktop, `360px` at `<= 1080px`); `pointer-events: none`.
- **Drawer Aside (`.record-detail-drawer`):** `pointer-events: auto; display: flex; flex-direction: column; width: 100%; height: 100%; background: var(--glass-surface-strong); border-left: 1px solid var(--glass-border); box-shadow: -18px 0 40px rgba(49, 62, 73, .18); backdrop-filter: blur(18px)`.
- **Header (`.record-detail-header`):** `min-height: 92px; padding: 22px 22px 18px; border-bottom: 1px solid var(--line)`. Contains uppercase category subtitle (`p`, `9px`, `letter-spacing: .12em`), record title (`h2`, `19px`), optional `.detail-status` pill, and circular `30px × 30px` `.record-detail-close` button (`×`).
- **Body (`.record-detail-content`):** `flex: 1; overflow-y: auto; padding: 12px 18px 28px`. Contains optional `.record-detail-profile-link` banner (`min-height: 40px; border-radius: 10px`) and stacked `.record-detail-section` blocks (`padding: 18px 4px; border-bottom: 1px solid var(--line)`) with `h3` (`13px`), key-value `dl` rows (`dt` `11px` muted left / `dd` `11px` bold right), and optional explanatory `p` (`11px`).

### 8.2 Global Date-Range Popover ([src/components/global-date-range-picker.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/global-date-range-picker.tsx), [globals.css:326-336, 580-583](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L326-L336))
- **Trigger (`.global-date-filter`):** `min-height: 38px; min-width: 214px; padding: 0 14px; gap: 10px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--glass-surface-strong); box-shadow: var(--shadow-soft); font-size: 12px`.
- **Popover Dialog (`.date-picker-popover`):** `position: absolute; z-index: 80; top: calc(100% + 9px); left: 0; width: min(326px, calc(100vw - 32px)); padding: 14px; border-radius: 15px; border: 1px solid var(--glass-border); background: var(--color-surface); box-shadow: var(--glass-shadow-strong); backdrop-filter: none` (strictly opaque).
- **Internal Structure:** Month navigation bar (`.date-picker-month` with `28px × 28px` prev/next buttons), 7-column weekday header (`.date-picker-weekdays`), 42-day grid (`.date-picker-grid` with `31px` buttons, `.outside-month`, `.in-range`, `.selected`), summary line (`.date-picker-summary`), and 2-column preset grid (`.date-picker-presets`: `All time`, `Today`, `This Week`, `This Month`, `Last 7 Days`, `Last 15 Days`, `Last 30 Days`).

### 8.3 Account Menu Popover ([src/components/account-control.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/account-control.tsx), [globals.css:431-440](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L431-L440))
- Anchored above `.sidebar-footer` (`position: absolute; z-index: 20; left: 8px; right: 8px; bottom: 54px; padding: 10px; border-radius: 12px; background: var(--glass-surface-strong); box-shadow: var(--glass-shadow-strong); backdrop-filter: blur(14px)`).
- When `.sidebar.collapsed` is active, it repositions to the right of the collapsed rail (`left: calc(100% + 9px); bottom: 0; width: 174px`).

### 8.4 Chart & Ranking Hover Tooltips ([globals.css](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/globals.css))
- **SVG Revenue Chart Tooltip (`.chart-point-tooltip`):** `146px × 42px` `<rect rx="8">` filled with opaque `var(--color-surface)` and stroked with `color-mix(in srgb, var(--color-accent-highlight) 34%, var(--color-border))`, displaying date (`.chart-tooltip-label`, `9px`) and formatted peso amount (`.chart-tooltip-value`, `11px` bold).
- **Top Truck Profile Preview Pill (`.top-truck-preview`):** `min-width: 126px; padding: 9px 11px; border-radius: 9px; background: var(--glass-surface-strong); box-shadow: var(--glass-shadow-strong)` revealed on hover/focus of `.top-truck-link`.

---

## 9. Multi-Select Filter Dropdowns

### 9.1 DeliveryFilterDropdown & TruckFilterDropdown ([src/components/delivery-filter-dropdown.tsx](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/delivery-filter-dropdown.tsx), [src/components/truck-filter-dropdown.tsx](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/truck-filter-dropdown.tsx))
Replaces single-value select popovers with dedicated multi-criteria filter dropdowns:
- **Trigger Button (`.filter-dropdown-btn`):**
  - Displays filter category label (e.g., `Client & Truck filters` or `Fleet filters`) with an active count badge (`.filter-badge-pill`, `background: var(--color-accent); color: #fff; font-size: 10px; font-weight: 800; border-radius: 999px; min-width: 18px; text-align: center`).
  - Animated chevron indicator flips `180deg` on open.
- **Menu Container (`.delivery-filter-menu`, `.truck-filter-menu`):**
  - `position: absolute; z-index: 50; top: calc(100% + 8px); left: 0; min-width: 290px; padding: 12px; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--color-surface); box-shadow: var(--glass-shadow-strong)`.
  - Search input at the top filters list items in real time.
- **Filter Groups:** Checkbox items with custom checkbox styling, item counts, and category headers.
- **Footer Actions:** `Clear all` button resets active filters; `Apply` confirms selection and dismisses menu. Active filter chips are rendered outside the dropdown with removable `×` tags.

---

## 10. Route & Store Drop-off Sequence Timeline

### 10.1 DeliveryDropoffTimeline ([src/components/delivery-dropoff-timeline.tsx](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/delivery-dropoff-timeline.tsx))
Renders the step-by-step route sequence in detail drawers and inspectors:
- **Timeline Rail (`.drawer-dropoff-timeline`):** Vertical rail connecting drop-off nodes with a subtle vertical line (`width: 2px; background: var(--color-border-subtle)`).
- **Stop Node (`.drawer-dropoff-node`):** Circular numbered badge (`28px × 28px; border-radius: 50%; background: var(--color-accent); color: #fff; font-size: 11px; font-weight: 800; display: grid; place-items: center`).
- **Stop Card (`.drawer-dropoff-card`):**
  - Surface: `padding: 12px 14px; border-radius: 12px; background: var(--glass-surface-strong); border: 1px solid var(--glass-border)`.
  - Header: Displays `Store Drop-off #N` label alongside a document badge:
    - `✓ POD Attached`: Green pill (`rgba(16, 185, 129, 0.12)`, text `#059669`).
    - `POD Attached • Docs Pending`: Amber pill (`rgba(245, 158, 11, 0.12)`, text `#d97706`).
    - `Missing POD`: Grey outline pill (`var(--color-border)`, text `var(--color-text-muted)`).
  - Body: Store name (`font-weight: 700; font-size: 13px`) and destination area (`font-size: 11.5px; color: var(--color-text-muted)`).
  - Footer: Entry fee / gate toll indicator (`Entry fee: ₱150.00` or `None (₱0)` or `Not applicable`).

---

## 11. Financial Attribution & Deletion Governance

### 11.1 Financial Breakdown Cards ([src/components/delivery-financial-breakdown.tsx](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/delivery-financial-breakdown.tsx))
Provides complete unit economics attribution inside record drawers:
- **Revenue Card:** `Delivery Revenue` with green highlight badge.
- **Expense Grid:** Itemizes **Diesel Fuel**, **Highway Tolls**, **Store Entry Fees**, and **Crew Compensation**.
- **Net Calculation:** Shows **Net Profit** (`Delivery Revenue - Trip Expenses`) and **Profit Margin** percentage with conditional alert coloring for negative return trips.

### 11.2 Audited Deletion Dialogs ([src/components/confirm-delivery-deletion-dialog.tsx](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/confirm-delivery-deletion-dialog.tsx), `truck-profitability/page.tsx`)
Enforces governance standards for destructive administrative actions:
- Restricted strictly to the `admin` role via RBAC verification.
- Renders high-contrast warning icon, item identification (waybill number or plate number), and explicit consequences notice.
- Modal backdrop traps focus and supports `Esc` key dismissal. Action button displays loading spinner during async deletion and audit event emission.


