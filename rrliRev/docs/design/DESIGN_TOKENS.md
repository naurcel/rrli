# RouteX Design Tokens

> **Document Role:** Canonical reference for all CSS custom properties, colors, surfaces, shadows, border radii, dimensions, and typography tokens implemented in [`src/app/globals.css`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/globals.css).  
> **Master Philosophy:** [`DESIGN_PHILOSOPHY.md`](./DESIGN_PHILOSOPHY.md)  
> **Last Verified & Audited:** November 2026

---

## 1. Core Color & Semantic Role Tokens

Defined on `:root` and overridden on `html[data-theme="dark"]` in `src/app/globals.css`:

| CSS Variable | Semantic Role | Light Mode (`:root`) | Dark Mode (`html[data-theme="dark"]`) |
| :--- | :--- | :--- | :--- |
| `--color-page` | Root viewport & app-shell canvas | `#f6f7f9` | `#141a21` |
| `--color-surface` | Elevated surface (cards, dialogs, popovers) | `#ffffff` | `#1b232c` |
| `--color-surface-subtle` | Muted surface fill (table headers, badges) | `#fbfcfb` | `#222c37` |
| `--color-text-primary` | Primary headings, body copy, strong figures | `#15201d` | `#edf3f7` |
| `--color-text-secondary` | Table cell values, control labels, subtitles | `#586762` | `#aebdc7` |
| `--color-text-muted` | Column headers, placeholders, secondary metadata | `#74827d` | `#84949f` |
| `--color-border` | Standard structural divider & card border | `#e6e8ec` | `#34414d` |
| `--color-border-subtle` | Row dividers (`td` border) & inner hairlines | `#edf1ee` | `#29343e` |
| `--color-accent` | Primary brand interactive accent (amber) | `#b45309` | `#f3a429` |
| `--color-accent-deep` | High-contrast hover/selected accent | `#7c2d12` | `#ffd187` |
| `--color-accent-soft` | Tinted accent surface (pills, active tabs) | `#fffbeb` | `#3a2b12` |
| `--color-accent-highlight` | Luminous amber highlight (chart strokes, CTAs) | `#f59e0b` | `#e89012` |
| `--color-status-success` | Positive metrics, completed/attached text | `#0f8a4f` | `#34d399` |
| `--color-status-warning` | Follow-up needed, missing POD, incomplete text | `#a86a0c` | `#fbbf24` |
| `--color-status-danger` | Critical error, rejected request, destructive text | `#dc2626` | `#f87171` |
| `--color-focus` | Keyboard `:focus-visible` outline color | `#f59e0b` | `#ffd166` |

---

## 2. Standard Compact Badge Tokens (`.routex-badge`)

Defined on `:root` for uniform, minimal, and functional status badges:

```css
--badge-radius: 5px;
--badge-font-size: 10.5px;
--badge-font-weight: 600;
--badge-letter-spacing: 0.02em;
--badge-line-height: 1.2;
--badge-padding-y: 2px;
--badge-padding-x: 6px;
--badge-min-height: 20px;
```

### Badge Tone Specifications

| Tone Class | Light Background | Light Text | Light Border | Dark Background | Dark Text | Dark Border |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `.tone-primary` | `#f1f5f9` | `#475569` | `#e2e8f0` | `rgba(56, 189, 248, .12)` | `#38bdf8` | `rgba(56, 189, 248, .25)` |
| `.tone-success` | `#f0fdf4` | `#166534` | `#dcfce7` | `rgba(16, 185, 129, .12)` | `#34d399` | `rgba(16, 185, 129, .25)` |
| `.tone-warning` | `#fffbeb` | `#92400e` | `#fef3c7` | `rgba(245, 158, 11, .12)` | `#fbbf24` | `rgba(245, 158, 11, .25)` |
| `.tone-danger` | `#fef2f2` | `#991b1b` | `#fee2e2` | `rgba(239, 68, 68, .12)` | `#f87171` | `rgba(239, 68, 68, .25)` |
| `.tone-purple` | `#faf5ff` | `#6b21a8` | `#f3e8ff` | `rgba(167, 139, 250, .12)` | `#c084fc` | `rgba(167, 139, 250, .25)` |
| `.tone-neutral` | `var(--color-surface-subtle)` | `var(--color-text-secondary)` | `var(--color-border)` | `transparent` | `var(--color-text-muted)` | `none` |

---

## 3. Surface & Shadow Tokens

| Token | Light Mode Value | Dark Mode Value | Applied To |
| :--- | :--- | :--- | :--- |
| `--glass-surface` | `rgba(255, 255, 255, .72)` | `rgba(27, 35, 44, .84)` | `.topbar`, `.notice`, `.stat-card` |
| `--glass-surface-strong` | `rgba(255, 255, 255, .86)` | `rgba(31, 41, 51, .94)` | `.nav-item.active`, `.secondary-button`, `.filter-button`, `.rounded-select-trigger`, `.global-date-filter` |
| `--glass-border` | `rgba(255, 255, 255, .86)` | `rgba(145, 164, 178, .2)` | `1px solid` specular border on cards and controls |
| `--shadow-soft` | `4px 4px 10px rgba(190, 197, 207, .38), -4px -4px 10px rgba(255, 255, 255, .8)` | `5px 6px 14px rgba(0, 0, 0, .3), -3px -3px 10px rgba(55, 69, 81, .12)` | Secondary buttons, dropdown triggers, date filter |
| `--shadow-inset` | `inset 3px 3px 7px rgba(190, 197, 207, .35), inset -3px -3px 7px rgba(255, 255, 255, .85)` | `inset 3px 3px 8px rgba(0, 0, 0, .38), inset -2px -2px 6px rgba(67, 82, 94, .09)` | Recessed text inputs, search boxes, active button presses |
| `--glass-shadow-strong` | `10px 14px 30px rgba(148, 158, 173, .28), -8px -8px 22px rgba(255, 255, 255, .9), inset 0 1px 0 rgba(255, 255, 255, .72)` | `10px 14px 30px rgba(0, 0, 0, .34), -5px -5px 18px rgba(57, 71, 83, .1), inset 0 1px 0 rgba(70, 85, 97, .08)` | Modal dialogs, `.records-card`, popover menus |

---

## 4. Border Radius Scale

| Radius | CSS Value | Applied Components |
| :--- | :--- | :--- |
| **`5px`** | `5px` / `--badge-radius` | `.routex-badge`, `.pagination button`, `.pagination span` |
| **`7px`** | `var(--radius-control)` / `7px` | `.search-box`, `.date-picker-presets button` |
| **`8px`** | `8px` | `.secondary-button`, `.notice`, `.date-picker-month button`, `.date-picker-grid button` |
| **`9px`** | `9px` | `.nav-item`, `.sidebar-collapse-toggle`, `.rounded-select-menu button` |
| **`10px`** | `var(--radius-card)` / `10px` | `.stat-card`, `.records-card`, `.export-unboxed-table-wrap` |
| **`12px–14px`** | `12px` / `14px` | `.primary-action-button` (`8px`–`12px`), `.rounded-select-trigger`, `.global-date-filter`, `.routex-dialog` (`14px`–`16px`), `.settings-card` (`14px`) |
| **`999px` / `50%`** | Pill / Circle | Circular avatars, theme toggle, delivery status tabs, action pills |

---

## 5. Layout Dimensions & Sizing

| Token | Canonical Value | Applied To |
| :--- | :--- | :--- |
| `--sidebar-width` | `248px` | Default expanded sidebar width |
| `--operational-sidebar-width` | `248px` (expanded) / `84px` (collapsed) / `66px` (mobile) | Dynamic sidebar width applied to root shell |
| `--content-max` | `1250px` | Center container max width on wide screens |
| `topbar` height | `72px` (desktop) / `60px` (mobile) | Header chrome |

---

## 6. Canonical Z-Index Stacking Hierarchy

| Token | Canonical Value | Layer / Element Category |
| :--- | :--- | :--- |
| `--z-base` | `1` | In-flow content, card interiors, and local stacking contexts |
| `--z-sticky` | `100` | Sticky topbars, sticky table headers, sticky settings navigation |
| `--z-dropdown` | `200` | Dropdown menus, `<RoundedSelect />` listboxes, popovers, date picker overlays |
| `--z-modal-backdrop` | `1000` | Fullscreen modal scrims and dialog backdrops |
| `--z-modal` | `1050` | Floating modal containers, edit delivery dialogs, confirmation dialogs |
| `--z-tooltip` | `1200` | System tooltips, toast notifications, floating help badges |

