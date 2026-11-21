# RouteX Layout and Spacing

> **Document Role:** Structural specification for the application shell, sidebar dimensions, main content viewport, page padding rhythm, grid systems, and responsive breakpoints.  
> **Master Philosophy:** [`DESIGN_PHILOSOPHY.md`](./DESIGN_PHILOSOPHY.md)  
> **Last Verified & Audited:** November 2026

---

## 1. Application Shell & Viewport Architecture

RouteX uses a **fixed-viewport workspace shell**:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ html / body (height: 100%, min-width: 320px, overflow: hidden)               │
│ ┌──────────────┬───────────────────────────────────────────────────────────┐ │
│ │ .sidebar     │ .main-content (height: 100vh, overflow-y: auto,           │ │
│ │ (sticky,     │                overflow-x: hidden)                        │ │
│ │  100vh)      ├───────────────────────────────────────────────────────────┤ │
│ │              │ .topbar (height: 72px desktop / 60px mobile)              │ │
│ │ 248px exp.   ├───────────────────────────────────────────────────────────┤ │
│ │  84px coll.  │ .content-wrap (padding: 40px 72px 46px desktop)           │ │
│ │  66px mobile │   ├─ .page-intro                                          │ │
│ │              │   ├─ .stat-grid (KPI summary cards)                       │ │
│ │              │   ├─ .records-card (status tabs + filters + table)        │ │
│ │              │   └─ <TablePagination />                                  │ │
│ └──────────────┴───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Outer Shell Rules
- **`html` & `body`:** `height: 100%; overflow: hidden; min-width: 320px; margin: 0; background: var(--color-page)`.
- **`.app-shell`:** `display: flex; height: 100vh; min-height: 0; overflow: hidden`.
- **`.main-content`:** Independent vertical scroll container (`height: 100vh; overflow-y: auto; overflow-x: hidden`).

---

## 2. Sidebar Dimensions & States

Implemented in [`OperationalSidebar`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/operational-sidebar.tsx) and [`SidebarStateProvider`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/components/sidebar-state.tsx):

| State / Viewport | Width | Behavior & Content |
| :--- | :--- | :--- |
| **Expanded (Default)** | `248px` | Full brand logo, primary navigation links with text labels, management links, and bottom radiating ambient ray. |
| **Collapsed (User Toggled)** | `84px` | Compact icon-only rail with tooltips on hover. Maximizes screen real estate for wide data tables. |
| **Mobile (`<= 700px`)** | `66px` | Compact icon rail; topbar date filter collapses into page view. |

---

## 3. Page Spacing & Content Padding (`.content-wrap`)

- **Desktop (`> 900px`):** `width: 100%; max-width: 1250px; margin: 0 auto; padding: 40px 72px 46px; box-sizing: border-box`.
- **Tablet (`<= 900px`):** `padding-inline: 38px`.
- **Mobile (`<= 700px`):** `padding-top: 28px; padding-inline: 20px`.

---

## 4. Vertical Rhythm & Component Flow

Standard operational pages follow a disciplined vertical sequence:

1. **Back Link (`.back-link`)** *(Detail & Edit pages)*: `margin-bottom: 16px; font-size: 13px; font-weight: 600; color: var(--color-accent)`.
2. **Page Introduction (`.page-intro`)**: `display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px`.
3. **KPI Stat Grid (`.stat-grid`)**: `display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px`.
4. **Data Records Card (`.records-card`)**:
   - Status Tabs: `padding: 0 24px 16px`.
   - Filters Toolbar: `display: flex; gap: 12px; padding: 0 24px 16px`.
   - Table Wrapper: `width: 100%; overflow-x: auto`.
   - Table Pagination: `padding: 16px 24px`.

---

## 5. Modal Dialog Layer (`.routex-dialog-layer`)

- Fixed viewport overlay: `position: fixed; inset: 0; z-index: 1000; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(12px)`.
- Centered layout: `display: grid; place-items: center; padding: 20px`.
- Dialog container: `width: min(100%, 720px); max-height: 90vh; border-radius: 16px`.
