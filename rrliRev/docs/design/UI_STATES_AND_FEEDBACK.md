# RouteX UI States & Visual Feedback

> **Scope:** This document defines how RouteX communicates status, urgency, validation errors, scope boundaries, empty results, loading/busy states, and disabled controls. For component structural specs, see [`COMPONENT_DESIGN.md`](./COMPONENT_DESIGN.md); for exact color tokens, see [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md).

---

## 1. State Design Principles

RouteX is designed for daily operational monitoring where users scan dozens of delivery trips, expenses, and fleet units at a time. To prevent visual fatigue ("alarm blindness"):

1. **Restrained Status Signaling:** Status is communicated through compact inline dot indicators (`.pod-status`), small pill badges (`.detail-status`, `.fleet-status`, `.report-status`), or localized typography color shifts—never by painting entire table rows red, yellow, or green.
2. **Conditional Urgency:** High-priority follow-up panels (such as the Dashboard's **Attention Needed** card) render only when actionable exceptions exist (`missingPods > 0`) and collapse completely when operations are clear.
3. **Contextual Explanations Over Silent Locks:** Whenever an action or navigation item is unavailable in the current build scope, it remains visible with a subtle lock indicator (`◌`), `disabled` semantics, and a descriptive `title` tooltip or inline scope notice explaining why.

---

## 2. Semantic Status Indicators

### A. Positive / Attached / Active / Ready State

Used when Proof of Delivery (POD) is verified, a truck is active in the fleet, a report is ready, or a KPI trend is favorable:

| Pattern | Selector | Visual Treatment (Light Mode) | Visual Treatment (Dark Mode) |
| :--- | :--- | :--- | :--- |
| **Inline Table Dot + Label** | `.pod-status.attached` | `6px` circle (`#4eae83`) + `11px` bold text (`#318260`), no background pill | Inherits `#4eae83` dot + `#318260` text |
| **Pill Badge** | `.detail-status.success`, `.fleet-status` (Active), `.report-status.ready` | Background `#e2f5ec`, text `#07834e`, `border-radius: 999px`, `10px` bold | Background `rgba(24, 111, 75, .35)`, text `#71d7a9` |
| **KPI Trend Delta** | `.stat-meta.positive` | `11px` semi-bold `#32906b` (`↑ 24.2%`) paired with muted `em` (`#9ba6a2`, `vs prior period`) | `#32906b` / `var(--color-text-muted)` |
| **Drawer Value Text** | `.record-detail-section dd.success` | `11px` bold `var(--color-status-success)` (`#0f8a4f`) | `#46ba86` |
| **KPI Card Corner Glow** | `.stat-card:nth-child(2)` | `--glow-success` radial emerald wash (`rgba(50, 144, 107, .12)`) | `rgba(70, 186, 134, .18)` |

### B. Warning / Missing POD / Follow-Up / Preview State

Used when a delivery is missing its POD attachment, a KPI requires review, a truck's net profit is negative, or a report is in preview status:

| Pattern | Selector | Visual Treatment (Light Mode) | Visual Treatment (Dark Mode) |
| :--- | :--- | :--- | :--- |
| **Inline Table Dot + Label** | `.pod-status.missing` | `6px` circle (`#d7914c`) + `11px` bold text (`var(--orange)` / `#a86a0c`), no background pill | `#d7914c` dot + `#f0ae4a` text |
| **Pill Badge** | `.detail-status.warning`, `.report-status.preview` | Background `#fff4d6`, text `#a86a0c`, `border-radius: 999px`, `10px` bold | Background `rgba(153, 103, 24, .35)`, text `#f5c466` |
| **KPI Trend / Negative Net** | `.stat-meta.warning`, `.truck-performance-kpis strong.warning`, `.record-detail-section dd.warning` | `var(--color-status-warning)` (`#a86a0c`) | `#f0ae4a` |
| **KPI Card Corner Glow** | `.stat-card:nth-child(4)` | `--glow-warning` radial amber-gold wash (`rgba(217, 119, 6, .14)`) | `rgba(245, 158, 11, .2)` |

### C. Neutral / Inactive / Read-Only State

Used for decommissioned/inactive fleet units, read-only configuration badges, and scope pills:

| Pattern | Selector | Visual Treatment (Light Mode) | Visual Treatment (Dark Mode) |
| :--- | :--- | :--- | :--- |
| **Inactive Fleet Pill** | `.fleet-status.inactive` | Background `#eef1ef`, text `#66736d`, `border-radius: 999px`, `10px` bold | Background `rgba(117, 132, 125, .22)`, text `#c0ccc5` |
| **Read-Only / Preview Pill** | `.settings-readonly-pill`, `.preview-pill`, `.settings-card-state` | Translucent glass surface, border `var(--glass-border)`, text `var(--color-text-secondary)` or `var(--color-text-muted)` | Dark glass surface (`rgba(23, 33, 29, .78)`), text `var(--color-text-secondary)` |

---

## 3. Urgent Operational Follow-Up (`.dashboard-attention`)

When actionable exceptions exist (such as deliveries with missing PODs), the Dashboard renders `<section className="records-card dashboard-attention">`:

- **Container:** Uses the standard frosted glass `.records-card` surface rather than an alarming red banner.
- **Grid Items (`.attention-item.attention-link`):**
  - `min-height: 90px`, `padding: 17px 23px`, `padding-right: 34px`.
  - Displays a bold `13px` count and issue title (`<strong>4 deliveries missing POD</strong>`) above a `12px` muted explanation (`<span>Follow up before closing billing period</span>`).
  - Interactive hover/focus state tints the background with `color-mix(in srgb, var(--color-accent-soft) 62%, transparent)` and reveals a right-aligned `›` chevron (`font-size: 19px; color: var(--color-accent)`) that slides `4px` rightward (`translate(-4px, -50%) → translate(0, -50%)`).
  - Clicking the item deep-links directly to `/deliveries?pod=Missing` so the user can immediately resolve the exception.

---

## 4. Validation Errors, Destructive Actions & Fallback Boundaries

### A. Inline Form & Action Errors (`role="alert"`)

RouteX uses concise inline text alerts positioned immediately above or below the relevant form action row—avoiding heavy red error boxes that shift page layouts:

| Context | Selector | Typography & Spacing | Color (Light / Dark) |
| :--- | :--- | :--- | :--- |
| **Creation Form Validation** | `p.form-error` | `font-size: 11px; font-weight: 600; margin: -4px 0 0` | `#a83a2f` / `#f19180` |
| **Login Authentication Error** | `p.login-error` | `font-size: 11px; font-weight: 600; margin: -4px 0 0` | `#aa4433` / `#f19180` |
| **Account Menu Sign-Out Error** | `.account-menu-popover > p` | `font-size: 9px; line-height: 1.35; margin: 6px 2px 0` | `#a83a2f` / `#f19180` |

**Accessibility Requirement:** Every dynamic error paragraph must include `role="alert"` so screen readers announce validation failures immediately upon submission.

### B. Destructive Control Variant

For destructive user actions (such as removing a custom uploaded truck photo in [`src/components/truck-photo-manager.tsx`](../../../src/components/truck-photo-manager.tsx)):

- Uses `.truck-photo-button-danger` paired with `.truck-photo-button`.
- Retains the translucent glass pill surface (`rgba(255, 255, 255, .86)`) while shifting the label color to crimson (`#a83a2f` in light mode, `#f19180` in dark mode).

### C. Route Error Boundary (`src/app/error.tsx`) & 404 Not Found (`src/app/not-found.tsx`)

When an unexpected runtime exception or unknown route occurs:

1. **Runtime Error Boundary (`.fallback-page` > `.fallback-panel`):**
   - Centered glass card (`width: min(100%, 540px); padding: 34px; border-radius: var(--radius-card)`) over the warm ambient canvas.
   - Displays a `52px` accent code (`Error`), an `.eyebrow` (`Application fallback`), a `clamp(24px, 4vw, 32px)` heading, a calm explanation that operational records remain safe, and `.fallback-actions` (`Try again` primary button + `Return to dashboard` secondary link).
2. **404 Not Found (`.minimal-not-found`):**
   - Minimalist centered layout (`width: min(100%, 460px); padding: 28px 20px`) with a `clamp(38px, 6vw, 58px)` `404` display heading (`color: var(--color-accent)`), brief explanation, and a single `.primary-button` link (`Go to dashboard`).

---

## 5. Informational Banners & Scope Notices

### A. Dismissible Operational Notice Banner (`.notice`)

Used at the top of a workspace page (below `.topbar`) to communicate contextual state, such as active local preview storage or newly created records:

```tsx
<section className="notice" role="status">
  <div className="notice-copy">
    <span className="notice-icon" aria-hidden="true">i</span>
    <p>
      <strong>Local preview active:</strong>{" "}
      <span>New records are saved in this browser session for preview verification.</span>
    </p>
  </div>
  <button type="button" aria-label="Dismiss notice">×</button>
</section>
```

- **Surface:** Sage-tinted translucent glass (`#f2faf5` / `var(--glass-surface)` in light mode; `rgba(27, 55, 45, .52)` with `rgba(88, 168, 134, .28)` border in dark mode), `border-radius: 14px`, `padding: 9px 14px`.
- **Icon Badge (`.notice-icon`):** `17px × 17px` circle (`background: #4ca980; color: #fff; font-size: 11px; font-weight: 700`).
- **Dismiss Button:** Plain `16px` `×` button (`color: #6b7d75`) on the right edge.

### B. Login Preview Note (`.login-preview-note`)

- Compact `9px–10px` variant of `.notice` anchored at `margin-top: auto` inside `.login-form-wrap`, informing operators about preview credentials or authentication mode without competing with the `Sign In` button.

### C. Page Footer Scope Note (`.scope-note`)

- Positioned at the bottom of module pages (`margin: 18px 2px 0; font-size: 11px; color: #9aa6a1`).
- Prefixed by a `10px` sage-green bullet (`<span aria-hidden="true">●</span>` colored `#71b494`) to summarize the current module's data scope.

---

## 6. Empty States

When a search query, status filter, or date range returns zero matching records, RouteX replaces the table body, card grid, or chart canvas with a structured empty state rather than rendering an empty table header with zero rows.

### Standard Empty State Variants

| Variant | Selector | Dimensions | Structure & Content |
| :--- | :--- | :--- | :--- |
| **Table / List Empty State** | `.empty-state` | `min-height: 170px`, `padding: 24px`, `gap: 5px` | Centered grid with `<strong>` lead (`14px`, `var(--ink)`) and `<span>` guidance (`12px`, `#73827b`, `max-width: 360px`) |
| **Chart Empty State** | `.empty-state.chart-empty-state` | `min-height: 232px` | Preserves the exact vertical height of the Dashboard trend chart when no trips fall within the selected date range |
| **Fleet Grid Empty State** | `.empty-state.fleet-empty-state` | `min-height: 120px`, `grid-column: 1 / -1` | Spans all columns of `.fleet-grid` inside a `.records-card` wrapper |
| **Module Placeholder Empty State** | `.hr-empty-state`, `.settings-empty-card` | `min-height: 260px; padding: 32px` (`.hr-empty-state`); `width: min(100%, 530px); padding: 28px` (`.settings-empty-card`) | Explains planned or read-only module boundaries with clear typography and optional action links |
| **Missing Entity Profile** | `.preview-profile-empty` | `min-height: calc(100vh - 180px)` | Centered card with `.eyebrow`, `28px` `h1`, description, and `.primary-button` back to `/fleet` |

**Copywriting Rule for Empty States:**
1. The `<strong>` heading must state clearly what is empty (e.g., `"No deliveries match the current filters"`).
2. The `<span>` or `<p>` subcopy must tell the user how to recover (e.g., `"Try clearing the search query, switching the POD filter, or expanding the global date range."`).

---

## 7. Loading, Busy, Disabled & Selected States

### A. Loading & Async Submission States

- **Form / Page Busy State:**
  - Set `aria-busy={isSubmitting}` on the form or `<main>` container (e.g., `<main className="login-page" aria-busy={isSubmitting}>`).
  - Disable the submit trigger (`disabled={isSubmitting}`), which applies `cursor: wait` and reduces opacity (`0.65` on `.login-form-wrap button:disabled`, `0.72` on `.account-menu-signout:disabled`).
  - Swap button text to an active present-participle label with an ellipsis (`"Signing in…"`, `"Signing out…"`, `"Applying…"`).
- **Hydration & Local Storage Read Guard:**
  - Client components that merge `window.localStorage` preview records read storage inside `useEffect` (or lazy state initializers guarded for browser execution) so initial server HTML and hydrated client DOM match without layout flicker.

### B. Disabled & Scope-Locked Controls

- **Disabled Buttons & Inputs (`:disabled`):**
  - `cursor: not-allowed` (`cursor: default` on passive `.settings-card-action:disabled`).
  - Reduced opacity (`0.5` on `.date-picker-preset-custom:disabled`, `0.55` on `.export-button:disabled` and `.truck-photo-button:disabled`, `0.75` on `.sidebar .nav-item.disabled`).
  - Hover elevation (`transform: translateY(-1px)`) is suppressed on `:disabled` controls.
- **Locked Indicator (`.lock`):**
  - Disabled buttons and deferred navigation items append `<span className="lock" aria-hidden="true">◌</span>` (`font-size: 10px–11px; opacity: 0.7`) and provide a `title` attribute explaining when the capability is enabled.

### C. Selected & Active States Summary

| Control | Active / Selected Selector | Visual Indicator | ARIA / Semantic Attribute |
| :--- | :--- | :--- | :--- |
| **Sidebar Nav Item** | `.sidebar .nav-item.active` | `3.5px` left accent bar (`::before`), `font-weight: 900`, `20px` orange icon (`var(--color-accent)`), no background box | `aria-current="page"` |
| **RoundedSelect Option** | `.rounded-select-menu button.selected` | Warm amber tint `rgba(224, 100, 20, .14)` (`rgba(240, 138, 56, .22)` dark), `color: var(--color-accent-deep)`, `font-weight: 700` | `role="option"` + `aria-selected={true}` |
| **Segmented Tab Button** | `.metric-tabs button.active`, `.report-tabs button.active`, `.hr-tabs button.active` | Raised pill fill (`#fff` on metric tabs; `var(--color-accent-soft)` on report/HR tabs), bold text (`var(--ink)` or `var(--color-accent-deep)`) | `aria-pressed={true}` or `role="tab"` |
| **Calendar Day Button** | `.date-picker-grid button.selected` / `.in-range` | Solid accent gradient fill (`#fff` text) for `.selected` endpoints; soft amber tint (`var(--color-accent-soft)`) for `.in-range` days | `aria-pressed={isSelected}` |
| **Sortable Table Header** | `.table-sort-button.active` | Header text shifts to `var(--color-text-primary)` and `.table-sort-indicator` (`↑`/`↓`) shifts to `var(--color-accent)` (`opacity: 1`) | `<th aria-sort="ascending" \| "descending">` |
| **Multi-Step Wizard Pill** | `.delivery-stepper span.active` | Warm amber fill (`var(--color-accent-soft)`), `color: var(--color-accent-deep)`, border `rgba(224, 100, 20, .28)` | Visual step progress indicator |

