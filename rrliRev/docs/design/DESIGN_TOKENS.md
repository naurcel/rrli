# RouteX Design Tokens

**Document Role:** Canonical reference for all CSS custom properties, colors, surfaces, shadows, border radii, dimensions, and icon tokens implemented in [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css).  
**Related Documents:** [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) · [TYPOGRAPHY_AND_HIERARCHY.md](./TYPOGRAPHY_AND_HIERARCHY.md) · [COMPONENT_DESIGN.md](./COMPONENT_DESIGN.md) · [UI_STATES_AND_FEEDBACK.md](./UI_STATES_AND_FEEDBACK.md)

---

## 1. Core Color & Semantic Role Tokens

Defined on `:root` ([globals.css:4-22](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L4-L22)) and overridden on `html[data-theme="dark"]` ([globals.css:450](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L450)).

| CSS Variable | Semantic Role | Light Mode (`:root`) | Dark Mode (`html[data-theme="dark"]`) |
| :--- | :--- | :--- | :--- |
| `--color-page` | Root viewport & app-shell base canvas | `#f6f7f9` | `#141a21` |
| `--color-surface` | Opaque elevated surface (popovers, tooltips, fallback panels) | `#ffffff` | `#1b232c` |
| `--color-surface-subtle` | Secondary/muted surface fill (table headers, subtle pills) | `#fbfcfb` | `#222c37` |
| `--color-text-primary` | Primary headings, body copy, strong figures | `#15201d` | `#edf3f7` |
| `--color-text-secondary` | Table cell values, control labels, subtitles | `#586762` | `#aebdc7` |
| `--color-text-muted` | Eyebrows, column headers, placeholders, secondary metadata | `#74827d` | `#84949f` |
| `--color-border` | Standard structural divider & input/card border | `#e6e8ec` | `#34414d` |
| `--color-border-subtle` | Row dividers (`td` top border) & quiet internal hairlines | `#edf1ee` | `#29343e` |
| `--color-accent` | Primary brand interactive accent (links, icons, primary buttons) | `#b45309` | `#f3a429` |
| `--color-accent-deep` | High-contrast hover/selected accent & gradient anchor | `#7c2d12` | `#ffd187` |
| `--color-accent-soft` | Tinted accent surface (selected options, rank badges, active tabs) | `#fffbeb` | `#3a2b12` |
| `--color-accent-highlight` | Luminous amber highlight (chart strokes, active indicators, print CTA) | `#f59e0b` | `#e89012` |
| `--color-status-success` | Positive metrics, active/attached/verified semantic text | `#0f8a4f` | `#46ba86` |
| `--color-status-warning` | Follow-up needed, missing POD, pending/inactive semantic text | `#a86a0c` | `#f0ae4a` |
| `--color-focus` | Keyboard `:focus-visible` outline color (`3px solid`) | `#f59e0b` | `#ffd166` |

### 1.1 Legacy Alias Variables (Existing Implementation)
Line 21 of [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L21) defines seven shorthand aliases left over from the initial scaffold and mapped to the canonical tokens above:

```css
--ink: var(--color-text-primary);
--muted: var(--color-text-muted);
--line: var(--color-border);
--soft: var(--color-page);
--green: var(--color-accent);
--deep-green: var(--color-accent-deep);
--orange: var(--color-status-warning);
```

> **Convention & Recommendation:** Notice that `--green` and `--deep-green` actually resolve to **amber** (`--color-accent` and `--color-accent-deep`). Do not introduce new uses of `--green`, `--deep-green`, `--ink`, `--muted`, `--line`, or `--soft`; always reference the explicit `--color-*` custom properties in new rules.

### 1.2 Non-Tokenized Hardcoded Colors (Known Inconsistencies)
Several recurring component states in [src/app/globals.css](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css) currently use hardcoded hex/RGBA literals rather than `:root` tokens:

| Usage Context | Current Hardcoded Light Value(s) | Current Hardcoded Dark Value(s) | Recommended Token (If Promoted) |
| :--- | :--- | :--- | :--- |
| **Error / Destructive Text** (`.login-error`, `.form-error`, `.truck-photo-button-danger`, `.account-menu-popover > p`) | `#a83a2f` (lines 338, 439, 563) and `#aa4433` (line 637) | `#f19180` (`.dark .form-error`, line 642) | Recommend standardizing on a single `--color-status-danger` token (`#a83a2f` light / `#f19180` dark). |
| **Success Pill Badges** (`.detail-status.success`, `.fleet-status`, `.report-status.ready`) | Background `#e2f5ec`, text `#07834e` | Background `rgba(24, 111, 75, .35)`, text `#71d7a9` | Keep consistent across badge classes or extract `--color-badge-success-bg` / `-text`. |
| **Warning Pill Badges** (`.detail-status.warning`, `.report-status.preview`) | Background `#fff4d6`, text `#a86a0c` | Background `rgba(153, 103, 24, .35)`, text `#f5c466` | Keep consistent across badge classes or extract `--color-badge-warning-bg` / `-text`. |
| **Informational Notice Banner** (`.notice`, `.login-preview-note`) | Background `#f2faf5` / `rgba(255, 255, 255, .72)`, border `#d8e9df`, text `#597168`, strong `#27654d`, icon `#579875` | Background `rgba(27, 55, 45, .52)`, text `#b7d7c5`, strong `#c5ecd5` | Existing sage-tinted informational treatment. |
| **Inline Status Dots** (`.pod-status.attached`, `.pod-status.missing`) | Attached text `#318260`, dot `#4eae83`; Missing text `var(--orange)`, dot `#d7914c` | Inherits same values | Existing table status dot palette. |
| **Login Submit Button** (`.login-form-wrap .login-submit`) | Background `#2563eb`, shadow `rgba(37, 99, 235, .22)` (line 267) | Same | Intentional split-login visual exception; all in-app primary buttons use `--color-accent`. |

---

## 2. Surface, Frosted Glass & Ambient Glow Tokens

RouteX layers semi-translucent glass surfaces over an ambient radial-gradient app shell ([globals.css:14-20, 421, 450-452](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L14-L20)).

| Token / Selector | Light Mode Value | Dark Mode Value | Applied To |
| :--- | :--- | :--- | :--- |
| `--glass-surface` | `rgba(255, 255, 255, .72)` | `rgba(27, 35, 44, .84)` | `.topbar`, `.notice`, `.stat-card`, `.settings-card`, `.fleet-section-heading`, `.report-tabs`, `.truck-profile-neighbor` |
| `--glass-surface-strong` | `rgba(255, 255, 255, .86)` | `rgba(31, 41, 51, .94)` | `.nav-item.active`, `.secondary-button`, `.filter-button`, `.rounded-select-trigger`, `.global-date-filter`, `.record-detail-drawer`, `.account-menu-popover` |
| `--glass-border` | `rgba(255, 255, 255, .86)` | `rgba(145, 164, 178, .2)` | `1px solid` specular border on glass cards, buttons, popovers, and drawers |
| `--glass-blur` | `12px` | `12px` | `backdrop-filter: blur(var(--glass-blur))` on `.topbar`, `.notice`, controls (note: `.stat-card` and `.date-picker-popover` explicitly set `backdrop-filter: none`) |
| `--glow-amber` | `radial-gradient(110% 100% at 100% 0%, rgba(180, 83, 9, .09), transparent 62%)` | `radial-gradient(110% 100% at 100% 0%, rgba(243, 164, 41, .14), transparent 62%)` | `background-image` on `.nav-item.active`, `.stat-card`, `.records-card`, `.settings-card::after` |
| `--glow-success` | `radial-gradient(110% 100% at 100% 0%, rgba(15, 138, 79, .07), transparent 62%)` | `radial-gradient(110% 100% at 100% 0%, rgba(70, 186, 134, .11), transparent 62%)` | `background-image` on `.stat-card:nth-child(2)` |
| `.app-shell` background | `radial-gradient(900px 520px at 84% -8%, rgba(245, 158, 11, .1), transparent 68%), radial-gradient(760px 520px at 18% 100%, rgba(255, 255, 255, .8), transparent 70%), var(--color-page)` | `radial-gradient(900px 520px at 84% -8%, rgba(243, 164, 41, .1), transparent 68%), radial-gradient(760px 520px at 18% 100%, rgba(55, 70, 84, .24), transparent 70%), var(--color-page)` | Root application workspace background |

---

## 3. Elevation & Shadow Tokens

Defined in `:root` ([globals.css:11-17](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L11-L17)) and `html[data-theme="dark"]` ([globals.css:450](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L450)):

| Token | Light Mode Value | Dark Mode Value | Primary Usage |
| :--- | :--- | :--- | :--- |
| `--shadow-raised` | `7px 7px 16px rgba(190, 197, 207, .52), -7px -7px 16px rgba(255, 255, 255, .92)` | `8px 10px 22px rgba(0, 0, 0, .38), -4px -4px 12px rgba(58, 72, 84, .14)` | `.fallback-panel`, dark-mode card hover states |
| `--shadow-soft` | `4px 4px 10px rgba(190, 197, 207, .38), -4px -4px 10px rgba(255, 255, 255, .8)` | `5px 6px 14px rgba(0, 0, 0, .3), -3px -3px 10px rgba(55, 69, 81, .12)` | `.rounded-select-trigger`, `.global-date-filter`, `.theme-toggle`, `.report-tabs button.active` |
| `--shadow-inset` | `inset 3px 3px 7px rgba(190, 197, 207, .35), inset -3px -3px 7px rgba(255, 255, 255, .85)` | `inset 3px 3px 8px rgba(0, 0, 0, .38), inset -2px -2px 6px rgba(67, 82, 94, .09)` | Recessed inputs (`.truck-create-form input`, `.preview-create-form input`), `.hr-tabs`, `.truck-performance-kpis > div`, `:active` button states |
| `--glass-shadow` | `0 14px 35px rgba(148, 158, 173, .2)` | `0 14px 32px rgba(0, 0, 0, .28)` | Base glass elevation for `.stat-card`, `.truck-profile-neighbor` |
| `--glass-shadow-strong` | `10px 14px 30px rgba(148, 158, 173, .28), -8px -8px 22px rgba(255, 255, 255, .9), inset 0 1px 0 rgba(255, 255, 255, .72)` | `10px 14px 30px rgba(0, 0, 0, .34), -5px -5px 18px rgba(57, 71, 83, .1), inset 0 1px 0 rgba(70, 85, 97, .08)` | Primary container elevation on `.notice`, `.stat-card`, `.records-card`, `.nav-item.active`, `.rounded-select-menu`, `.date-picker-popover`, `.report-document` |
| `--glass-shadow-hover` | `0 14px 20px -9px rgba(148, 158, 173, .3)` | Inherits `:root` | Declared in `:root` for hover states |

### 3.1 Dynamic Pointer-Reactive Shadow Variables
Initialized on interactive targets at [globals.css:337](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L337) and updated dynamically by [`MouseReactiveShadows`](file:///c:/Users/suchi/Documents/rrli/src/components/mouse-reactive-shadows.tsx):
- `--mouse-shadow-x`: Default `0px`, clamped dynamically to `[-8.0px, 8.0px]` based on horizontal pointer offset from element center.
- `--mouse-shadow-y`: Default `2px`, clamped dynamically to `[-8.0px, 8.0px]` based on vertical pointer offset from element center.

---

## 4. Border Radius Scale

While `:root` defines two base radius tokens (`--radius-control: 7px` and `--radius-card: 10px`), individual component classes use a graduated radius scale depending on surface hierarchy:

| Radius Value | Token / CSS Value | Applied Components |
| :--- | :--- | :--- |
| **`5px`** | `5px` | `.pagination button`, `.pagination span`, `.sortable-table-header:focus-visible` |
| **`7px`** | `var(--radius-control)` / `7px` | `.search-box`, `.fallback-action`, `.fallback-link`, `.date-picker-presets button`, `.date-picker-grid button.in-range` |
| **`8px`** | `8px` | `.secondary-button`, `.export-button`, `.filter-button`, `.notice`, `.date-picker-month button`, `.date-picker-grid button`, `.account-menu-popover > button`, `.chart-point-tooltip rect` |
| **`9px`** | `9px` | `.nav-item`, `.sidebar-collapse-toggle`, `.rounded-select-menu button`, `.top-truck-preview`, `.truck-photo-button`, `.hr-tabs button` |
| **`10px`** | `var(--radius-card)` / `10px` | `.stat-card`, `.records-card`, `.records-card table`, `.report-tabs button`, `.record-detail-profile-link`, `.pod-attachment-trigger` |
| **`11px–12px`** | `11px` / `12px` | `.quick-action` (`11px`), `.primary-button` (`12px`), `.account-menu-popover` (`12px`), `.global-date-filter` (`12px`), `.fleet-section-heading` (`12px`) |
| **`13px–14px`** | `13px` / `14px` | `.rounded-select-trigger` (`14px`), `.rounded-select-menu` (`14px`), `.more-filters-control > .filter-button` (`14px`), `.more-filters-popover` (`14px`), `.report-print-button` (`13px`), `.report-tabs` (`14px`), `.truck-create-form input` (`13px`), `.preview-create-form input` (`13px`), `.report-card` (`14px`), `.settings-card` (`14px`) |
| **`15px–16px`** | `15px` / `16px` | `.date-picker-popover` (`15px`), `.truck-profile-neighbor` (`16px`) |
| **`20px–26px`** | `20px` / `24px` / `26px` | `.report-document` (`20px`), `.fleet-card` (`24px`), `.login-visual` (`26px`) |
| **`999px` / `50%`** | Pill / Circle | `.preview-pill`, `.detail-status`, `.fleet-status`, `.report-status`, `.metric-tabs button`, `.settings-readonly-pill`, `.truck-history-count` (`999px`); `.avatar`, `.help-button`, `.theme-toggle`, `.record-detail-close`, `.notice-icon`, `.delivery-stepper span` (`50%` / `999px`) |

---

## 5. Layout & Sizing Tokens

| Token / Constant | Value | Source & Purpose |
| :--- | :--- | :--- |
| `--sidebar-width` | `248px` | Default expanded sidebar width in `:root` ([globals.css:10](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L10)) and `EXPANDED_WIDTH` in [sidebar-state.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state.tsx#L6). |
| `--operational-sidebar-width` | `248px` (expanded) / `84px` (collapsed) | Set dynamically on `document.documentElement` by [`SidebarStateProvider`](file:///c:/Users/suchi/Documents/rrli/src/components/sidebar-state.tsx#L25). |
| `--content-max` | `1250px` | Maximum content width token in `:root` (used when `.record-detail-open` is active at [globals.css:532](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L532)). |
| `--record-detail-width` | `400px` (`360px` at `<= 1080px`) | Width of the right-hand [`RecordDetailDrawer`](file:///c:/Users/suchi/Documents/rrli/src/components/record-detail-drawer.tsx) workspace column ([globals.css:527, 533](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L527-L533)). |
| `--record-detail-reserved` | `0px` (closed) / `var(--record-detail-width)` (open) | Subtracts drawer width from `.main-content` when `body.record-detail-open` is present ([globals.css:677-680](file:///c:/Users/suchi/Documents/rrli/src/app/globals.css#L677-L680)). |

---

## 6. Iconography & Brand Asset Tokens

### 6.1 Shared `<Icon>` Primitive ([src/components/route-x-ui.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/route-x-ui.tsx))
RouteX does not use an external icon library (such as Lucide). Instead, it uses the `<Icon>` component in [src/components/route-x-ui.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/route-x-ui.tsx):
- **Navigation Vector Icons (`.icon-vector`):** When `<Icon>` receives one of the 8 navigation Unicode keys (`⌂`, `▤`, `▱`, `₱`, `▥`, `◎`, `◷`, `⚙`), it renders an inline `<svg className="icon-vector" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">`.
  - Sidebar icon box (`.sidebar .nav-item .icon`): `20px × 20px` grid container (`flex: 0 0 20px`).
  - SVG dimensions (`.sidebar .nav-item .icon-vector`): `18px × 18px` (`overflow: visible`).
- **Inline Action Glyphs:** For toolbar and button actions (`＋`, `⇩`, `⌕`, `≡`, `‹`, `›`), `<Icon>` renders the character directly inside `<span className="icon" aria-hidden="true">` (`width: 18px`, `font-size: 17px`, `line-height: 1`).
- **Note on HR Navigation Symbol:** In [src/components/operational-sidebar.tsx](file:///c:/Users/suchi/Documents/rrli/src/components/operational-sidebar.tsx#L20), `"Human resources"` passes symbol `"\u25c9"` (`◉`), whereas `navigationGlyphs` in `route-x-ui.tsx` defines `"\u25f7"` (`◷`). As a result, `"Human resources"` currently renders the literal glyph `◉` rather than an SVG path.

### 6.2 Brand & Media Assets (`public/`)
- **Expanded Sidebar & Login Logo:** `/branding/routex-logo-dblue.png` (`88px auto` in `.sidebar-brand-space::before`; `min(100%, 185px)` in `.login-logo`).
- **Collapsed Sidebar Symbol:** `/branding/routex-symbol-dblue.png` (`31px auto` in `.sidebar-brand-space::after`).
- **Login Visual Backdrop:** `/branding/login-glow.gif` (`.login-visual-media`, `object-fit: cover` over `#101a45`).
- **Default Account Avatar:** `/profiles/shinryu.png` (`31px × 31px` circular `.avatar` in sidebar footer).

