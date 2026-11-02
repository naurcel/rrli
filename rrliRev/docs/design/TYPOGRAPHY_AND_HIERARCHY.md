# RouteX Typography & Visual Hierarchy

> **Scope:** This document establishes the typographic scale, text roles, heading gradients, numeric alignment conventions, and visual reading hierarchy of RouteX. For raw CSS custom properties and color values, see [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md).

---

## 1. Typeface Architecture

### Primary Font Stack

RouteX uses **Readex Pro** as its sole typeface across headings, body copy, form controls, tables, and financial figures:

```css
:root {
  --font-sans: "Readex Pro";
}

body {
  font-family: var(--font-sans), "Avenir Next", "Segoe UI", sans-serif;
  font-size: 14px;
  color: var(--color-text-primary);
}

button,
input,
select {
  font: inherit;
}
```

### Font Loading & Weight Availability

In [`src/app/layout.tsx`](../../../src/app/layout.tsx), Google Fonts loads Readex Pro with weights `400`, `500`, and `600`:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

#### Existing Implementation vs. Browser Weight Synthesis

| Declared CSS `font-weight` | Loaded from Google Fonts? | Actual Rendering Behavior | Primary Usage in `globals.css` |
| :--- | :--- | :--- | :--- |
| `400` | Yes | Native glyph weight | Body copy, `.subtitle`, table cells (`td`), secondary descriptions |
| `500` | Yes | Native glyph weight | `.nav-item`, `.back-link`, `.preview-pill`, `.notice`, `.stat-meta em` |
| `600` | Yes | Native glyph weight | `.secondary-button`, `.filter-button`, `.export-button`, `.rounded-select-trigger`, `.account-chip`, `.stat-meta` |
| `700` | No (Synthesized) | Browser faux-bold synthesis | `h1`–`h3`, `.primary-button`, `.stat-card strong`, `.eyebrow`, `.stat-label`, `th`, `.money`, `.pod-status` |
| `750` | No (Synthesized) | Browser faux-bold synthesis | `.delivery-final-review dd`, `.pod-attachment-trigger` |
| `800` | No (Synthesized) | Browser faux-bold synthesis | `.login-logo`, `.chart-tooltip-value`, `.top-truck-list strong`, `.truck-rank`, `.sidebar-collapse-toggle .icon`, `.delivery-stepper span`, `.hr-workflow-list span`, `.more-filters-popover > span` |
| `900` | No (Synthesized) | Browser faux-bold synthesis | `.sidebar .nav-item.active .nav-label` |

> **Recommendation:** Update the Google Fonts stylesheet URL in [`src/app/layout.tsx`](../../../src/app/layout.tsx) to `wght@400;500;600;700;800` so that headings, primary buttons, KPI figures, and ranked numerals render using Readex Pro's true bold and extra-bold outlines rather than browser-synthesized bolding. Normalize `font-weight: 750` and `900` declarations to `700` or `800`.

---

## 2. Typographic Hierarchy & Role Scale

RouteX enforces a high-contrast typographic hierarchy where primary headings and KPI figures are large and tightly tracked (`-0.8px` to `-3px`), while operational metadata, table headers, and status labels are compact (`9px–11px`) with generous positive tracking (`+0.7px` to `+1.2px`) when uppercase.

### A. Display & Hero Headings

Used exclusively on full-screen standalone surfaces (Login split hero, Error boundary, 404 Not Found):

| Role | Selector | Size | Weight | Line Height | Letter Spacing | Color / Treatment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Login Hero Display** | `.login-visual-content h1` | `clamp(30px, 4vw, 62px)` (`clamp(28px, 8vw, 48px)` at `<= 760px`) | `700` | `0.98` | `-2px` | `#fff7ed` over dark amber gradient panel |
| **404 Display Heading** | `.minimal-not-found-copy h1` | `clamp(38px, 6vw, 58px)` | `700` | `0.95` | `-2.6px` | `var(--color-accent)` |
| **Fallback Status Code** | `.fallback-code` | `52px` | `700` | `1.0` | `-3px` | `var(--color-accent)` |

### B. Page Titles (`h1`)

Every authenticated workspace view begins with a single `<header className="page-intro">` (augmented with `.dashboard-welcome` on the Dashboard):

| Role | Selector | Size | Weight | Line Height | Letter Spacing | Treatment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Standard Page Title** | `.page-intro h1` | `clamp(30px, 3vw, 39px)` | `700` | `1.16` | `-1.7px` | Animated amber gradient clip (`heading-gradient-shift 9s ease-in-out infinite`), `padding-right: 0.18em` |
| **Dashboard Welcome Title** | `.dashboard-welcome h1` | `39px !important` (`clamp(30px, 7vw, 39px) !important` at `<= 700px`) | `700` | `1.16` | `-1.7px` | Animated amber gradient clip (`8s ease-in-out infinite`), `padding-bottom: 0.08em`, `padding-right: 0.18em` |
| **Fallback Panel Title** | `.fallback-panel h1` | `clamp(24px, 4vw, 32px)` | `700` | `1.08` | `-1.2px` | Solid `var(--color-text-primary)` |
| **Empty Profile Title** | `.preview-profile-empty h1` | `28px` | `700` | `1.15` | `-0.8px` | Solid `var(--color-text-primary)` |

#### Page Title Right-Padding Convention

Because `.page-intro h1` uses `-webkit-background-clip: text` with tight negative letter spacing (`-1.7px`), the rightmost glyph can clip against the bounding box in WebKit/Blink browsers. RouteX applies `padding-right: 0.18em` and `display: inline-block` on `.page-intro h1` to prevent glyph clipping. Do not remove `padding-right: 0.18em` when styling gradient-clipped headings.

### C. Section, Card & Modal Headings (`h2`, `h3`)

| Role | Selector | Size | Weight | Letter Spacing | Treatment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login Form Heading** | `.login-form-wrap h2` | `25px` | `700` | `-0.8px` | Solid `var(--ink)` |
| **Section Intro Heading** | `.administration-audit .section-intro h2` | `21px` | `700` | `-0.55px` | Solid `var(--color-text-primary)` |
| **Drawer Title** | `.record-detail-header h2` | `19px` | `700` | `-0.6px` | Solid `var(--color-text-primary)`, `line-height: 1.15` |
| **Prominent Card Heading** | `.top-trucks-card .records-heading h2`, `.report-document-header h2`, `.section-title-row h2`, `.hr-empty-state strong`, `.truck-profile-visual-copy strong` | `18px` | `700` | `-0.4px` to `-0.5px` | Solid text or static amber gradient clip on `.records-heading h2` |
| **Standard Card Heading** | `.records-heading h2` | `17px` | `700` | `-0.4px` | Static warm bronze-amber gradient clip (`105deg, #78350f 0%, #92400e 50%, #b45309 100%` in light mode; `#fef3c7 → #fcd34d → #f59e0b` in dark mode) |
| **Entity Card Title** | `.fleet-card-title h2`, `.truck-profile-neighbor > strong`, `.settings-empty-card p` | `16px` | `700` | `-0.3px` | Solid `var(--color-text-primary)` |
| **Sub-Table Heading** | `.report-table-heading h3` | `15px` | `700` | `-0.2px` | Solid `var(--color-text-primary)` |
| **Compact Card Heading** | `.report-card h3`, `.settings-card h3`, `.report-summary strong`, `.chart-legend strong`, `.date-picker-month strong` | `14px` | `700` | `-0.2px` | Solid `var(--color-text-primary)` |
| **Drawer Section / List Item Lead** | `.record-detail-section h3`, `.attention-item strong`, `.top-truck-link strong`, `.delivery-final-review strong`, `.hr-rules-grid strong` | `13px` | `700` | `-0.15px` | Solid `var(--color-text-primary)` |

### D. KPI Figures & Ranked Numerals

Financial and operational metrics scale dynamically based on container prominence:

| Role | Selector | Size | Weight | Letter Spacing | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard Primary KPI** | `.dashboard-stats .stat-card strong` | `31px` | `700` | `-1.05px` | Largest metric display; paired with `.stat-label` (`10px`) above and `.stat-meta` (`11px`) below |
| **Module Summary KPI** | `.stat-card strong` | `25px` | `700` | `-0.8px` | Used on Deliveries, Fleet, Transactions, Reports, and Administration summary strips (`margin: 10px 0 8px`) |
| **Dense Strip KPI** | `.hr-status-grid .stat-card strong` | `clamp(18px, 1.65vw, 25px)` | `700` | `-0.65px` | Fluid scaling for 6-column KPI grids |
| **Inline Profile KPI** | `.truck-performance-kpis strong` | `17px` | `700` | `-0.45px` | Compact 4-column metric strip inside Truck Profile hero |
| **Top Truck Rank #1** | `.top-truck-list li:nth-child(1) .truck-rank` | `29px` | `800` | `-1.4px` | Colored `var(--color-accent-deep)` (`#b8500b`) |
| **Top Truck Rank #2** | `.top-truck-list li:nth-child(2) .truck-rank` | `23px` | `800` | `-1.0px` | Colored `var(--color-accent)` (`#e06414`) |
| **Top Truck Rank #3** | `.top-truck-list li:nth-child(3) .truck-rank` | `17px` | `800` | `-0.5px` | Colored `color-mix(in srgb, var(--color-accent) 72%, var(--color-text-secondary))` |

### E. Body Copy, Subtitles & Interactive Controls (`11px–15px`)

| Size | Selectors | Weight | Line Height | Color Role |
| :--- | :--- | :--- | :--- | :--- |
| `15px` | `.minimal-not-found-copy > p`, `.login-visual-content > p:last-child` | `400` | `1.5` | `var(--color-text-secondary)` / `rgba(255, 247, 237, .82)` |
| `14px` | `body`, `.login-form-wrap input`, `.sidebar .brand` | `400` (`700` brand) | `1.4` | `var(--color-text-primary)` |
| `13px` | `.subtitle`, `.nav-item`, `.truck-create-form input`, `.preview-create-form input`, `.hr-workflow-list p` | `400` (`500` nav) | `1.35` (`.subtitle`) | `var(--muted)` (`#6e7d76`) for subtitles; `var(--color-text-primary)` for inputs |
| `12px` | `td`, `.secondary-button`, `.filter-button`, `.export-button`, `.rounded-select-trigger`, `.rounded-select-menu button`, `.global-date-filter`, `.search-box input`, `.fleet-card dt/dd`, `.truck-profile-list dt/dd`, `.delivery-final-review dt/dd`, `.hr-tabs button`, `.empty-state span` | `400`–`600` (`700` on `dd` / `.money`) | `1.35`–`1.45` | `#394a43` for table cells (`var(--color-text-secondary)` in dark mode) |
| `11px` | `.primary-button`, `.stat-meta`, `.pod-status`, `.table-footer`, `.scope-note`, `.preview-pill`, `.back-link`, `.preview-create-form > label`, `.record-detail-section dt/dd/p`, `.report-document th/td`, `.report-tabs button`, `.form-error`, `.login-error` | `500`–`700` | `1.3`–`1.45` | Contextual (`#fff` on primary button, `var(--color-text-secondary)` on labels/meta) |

### F. Eyebrows, Uppercase Labels & Micro Metadata (`9px–10px`)

Uppercase text in RouteX is restricted to structural labels, section eyebrows, table column headers, and status pills. Never set multi-sentence descriptions in uppercase.

| Role | Selector | Size | Weight | Letter Spacing | Transform | Color (Light / Dark) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Eyebrow** | `.eyebrow` | `10px` | `700` | `1.2px` | `uppercase` | `#8a9792` / `var(--color-text-muted)` |
| **KPI Card Label** | `.stat-label` | `10px` | `700` | `0.8px` | `uppercase` | `#8d9994` / `var(--color-text-muted)` |
| **Popover Section Label** | `.more-filters-popover > span` | `10px` | `800` | `0.08em` | `uppercase` | `var(--color-text-muted)` |
| **Pill / Segment / Weekday** | `.detail-status`, `.report-status`, `.truck-history-count`, `.metric-tabs button`, `.truck-photo-button`, `.settings-readonly-pill`, `.date-picker-weekdays span` | `10px` | `700` | `0` to `0.04em` | Standard / contextual | Contextual |
| **Table Column Header** | `th` | `9px` | `700` | `0.7px` | `uppercase` | `#96a19c` / `var(--color-text-muted)` |
| **Category / Context Label** | `.record-detail-header p`, `.settings-category`, `.top-truck-preview > span`, `.truck-performance-kpis span`, `.report-document-header p` | `9px` | `700` | `0.075em` to `0.14em` | `uppercase` | `var(--color-text-muted)` or `var(--color-accent)` |

---

## 3. Page Intro Composition Pattern

Every standard workspace page opens with a structured 3-tier vertical text hierarchy inside `.page-intro`:

```tsx
<header className="page-intro">
  <p className="eyebrow">Operations Monitoring</p>
  <h1>Deliveries</h1>
  <p className="subtitle">
    Review delivery records, trip financials, and proof-of-delivery follow-ups.
  </p>
</header>
```

### Spacing & Alignment Rules

1. **Eyebrow (`.eyebrow`):** `margin: 0 0 6px`, `10px`, uppercase, `letter-spacing: 1.2px`, muted neutral `#8a9792`. Identifies the operational domain above the page title.
2. **Heading (`h1`):** `margin: 0`, `clamp(30px, 3vw, 39px)`, `letter-spacing: -1.7px`, animated warm amber gradient text.
3. **Subtitle (`.subtitle`):** `margin: 6px 0 0`, `font-size: 13px`, `line-height: 1.35`, `color: var(--muted)`, `max-width: 560px` (`420px` inside `.dashboard-welcome`). Keeping `.subtitle` constrained to `560px` (`~65–75` characters per line) ensures comfortable scanning across wide monitors.

---

## 4. Numeric, Currency & Code Formatting Conventions

Because RouteX is a financial and logistics tracking system, numeric legibility and column alignment are critical to visual hierarchy.

### Currency Formatting (`formatPeso` & `.money`)

- All Philippine Peso amounts are formatted via [`src/lib/preview/format.ts`](../../../src/lib/preview/format.ts) (`formatPeso`), rendering a leading `₱` sign and comma-grouped integers (`₱197,700`).
- In data tables, currency cells use `<td className="money">`, which applies:
  ```css
  .money {
    font-weight: 700;
    color: var(--ink);
  }
  ```
- When displaying net profit or variance that can be negative:
  - Positive or zero values use default `var(--color-text-primary)` or `.stat-meta.positive` (`#32906b`).
  - Negative net profit values (e.g., on Truck Profile KPI strips or drawer detail lists) apply the `.warning` class (`color: var(--color-status-warning)`).

### Tabular Numerals & Identifier Codes

- **Vehicle Plate Numbers & Codes (`.truck-code`):**
  ```css
  .truck-code {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }
  ```
- **Record Reference Numbers (`DEL-1048`, `EXP-2041`):** Wrapped in `<strong>` inside the first table column (`td strong { color: var(--ink); font-weight: 700; }`) so the primary identifier anchors the left edge of every table row.
- **Right-Aligned Numeric Columns:**
  - In standard operational tables (`.records-card table`), the rightmost column (`th:last-child, td:last-child`) is right-aligned (`text-align: right`) and holds the primary financial figure (`Trip Rate`, `Amount`) or row action.
  - In multi-column financial breakdown tables (`.report-document table`), all numeric columns (`th:nth-child(n+3), td:nth-child(n+3)`) are right-aligned (`text-align: right`) with `white-space: nowrap` to maintain vertical decimal/comma alignment across rows and footer totals (`tfoot td`).

> **Recommendation:** Extend `font-variant-numeric: tabular-nums` beyond `.truck-code` to `.money`, `.stat-card strong`, `.report-document td:nth-child(n+3)`, and `.chart-tooltip-value` so that all currency columns and KPI counters align digits on an identical character width.

---

## 5. Text Truncation, Wrapping & Line-Length Rules

1. **Single-Line Controls & Headers:**
   - Buttons (`.primary-button`, `.secondary-button`, `.filter-button`, `.export-button`), pills (`.preview-pill`, `.detail-status`, `.fleet-status`, `.report-status`), and table headers (`th`, `.table-sort-button`) enforce `white-space: nowrap` so labels never break mid-phrase.
2. **Sidebar Navigation Labels (`.nav-label`):**
   - Uses `white-space: nowrap; overflow: hidden` so labels clip cleanly during the `224px ↔ 76px` sidebar width transition without reflowing into two lines.
3. **Top Trucks & Compact Lists:**
   - `.top-truck-preview p` uses single-line ellipsis truncation (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`) to prevent long route names from expanding fixed-height list cards.
4. **Prose & Notice Line Lengths:**
   - Subtitles (`.subtitle`): `max-width: 560px` (`420px` on Dashboard welcome).
   - Empty state descriptions (`.empty-state span`, `.hr-empty-state p`): `max-width: 360px–460px`, centered (`text-align: center`).
   - Drawer audit trail descriptions (`.record-detail-section p`): `font-size: 11px; line-height: 1.45; color: var(--color-text-secondary)`.

