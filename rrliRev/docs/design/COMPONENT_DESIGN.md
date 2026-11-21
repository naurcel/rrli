# RouteX Component Design

> **Document Role:** Structural markup, visual specifications, sizing, and variants for all reusable UI components in RouteX.  
> **Master Philosophy:** [`DESIGN_PHILOSOPHY.md`](./DESIGN_PHILOSOPHY.md)  
> **Last Verified & Audited:** November 2026

---

## 1. Action Buttons

RouteX uses standard action buttons with zero heavy drop-shadows:

| Button Class | Geometry | Visual Surface | Typography | Primary Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`.primary-action-button`** | `min-height: 40px`, `padding: 0 16px`, `gap: 8px` | `border-radius: 8px`; `background: linear-gradient(105deg, var(--color-accent-deep), var(--color-accent))`; `#fff` | `12px`, `font-weight: 700` | Primary page-level call to action (`Record delivery`, `Save changes`, `Confirm`). |
| **`.secondary-button`** | `min-height: 38px`, `padding: 9px 13px`, `gap: 8px` | `border-radius: 8px`; `background: var(--glass-surface-strong)`; `border: 1px solid var(--color-border)` | `12px`, `var(--color-text-secondary)` | Secondary header actions (`Requests`, `Import`, `Cancel`). |
| **`.filter-button`** | `min-height: 38px`, `padding: 0 12px`, `gap: 6px` | `border-radius: 7px`; `background: var(--color-surface)`; `border: 1px solid var(--color-border)` | `12px`, `var(--color-text-secondary)` | Inline toolbar filter triggers. |
| **`.export-btn-approve`** | `height: 28px`, `padding: 0 12px` | `border-radius: 6px`; `background: var(--color-accent)`; `#fff` | `11.5px`, `font-weight: 650` | Table row approval action in queues. |
| **`.export-btn-reject`** | `height: 28px`, `padding: 0 10px` | `border-radius: 6px`; `background: var(--color-surface)`; `border: 1px solid var(--color-border)`; `#dc2626` | `11.5px`, `font-weight: 600` | Table row rejection action in queues. |

---

## 2. Standard Compact Badge (`.routex-badge`)

Centralized status badge primitive replacing inconsistent legacy pill implementations:

- **Markup Structure:**
  ```tsx
  <span className="routex-badge tone-success">Completed</span>
  <span className="routex-badge tone-warning">Incomplete</span>
  <span className="routex-badge tone-danger">Rejected</span>
  <span className="routex-badge tone-primary">Cold Chain</span>
  <span className="routex-badge tone-neutral">Dry Cargo</span>
  ```
- **CSS Specifications:**
  - `min-height: 20px; padding: 2px 6px; border-radius: 5px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em`.

---

## 3. Modal Dialogs (`.routex-dialog-layer` & `.routex-dialog`)

The standard modal overlay system replacing arbitrary popups and slide-over drawers:

- **Layer Backdrop (`.routex-dialog-layer`):**
  - `position: fixed; inset: 0; z-index: 1000; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(12px); display: grid; place-items: center; padding: 20px; overflow-y: auto`.
- **Dialog Surface (`.routex-dialog`):**
  - `background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.2); width: min(100%, 720px); max-height: 90vh; display: flex; flex-direction: column`.
  - Header: Sticky title bar with title, subtitle, and close `×` button.
  - Body: Scrollable content container (`overflow-y: auto`).
  - Footer: Sticky actions bar with right-aligned `Cancel` and `Submit` buttons.
- **Applied In:** Backdating Requests queue, Edit Delivery modal, Spreadsheet Import validation modal, Audited Deletion confirmation.

---

## 4. Search & Filter Bar (`.filters`)

Standard toolbar positioned directly above data tables:

- **Search Field (`.search-box`):**
  - Magnifying glass icon, placeholder, and search buffering indicator (`.search-buffer-indicator`).
  - `flex: 1; max-width: 450px; min-height: 38px; border-radius: 7px; border: 1px solid var(--color-border); background: var(--color-surface)`.
- **Date Range Integration:**
  - `<GlobalDateRangePicker />` placed naturally alongside search with preset chips ("All Time", "Today", "Last 7 Days", "This Month") and custom calendar popover.
- **Filter Dropdown (`<DeliveryFilterDropdown />`):**
  - Multi-select dropdown with chip counts, checkboxes, and "Clear all" button.

---

## 5. Data Tables & Input-Based Pagination

- **Container (`.records-card`):** Elevated white surface with rounded corners (`10px`), specular border, and internal `.table-wrap` for horizontal overflow.
- **Headers (`th` & `<SortableTableHeader />`):**
  - `font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted)`.
  - 3-state sorting indicator (`↕`, `↑`, `↓`).
- **Pagination Primitive (`<TablePagination />`):**
  - Strictly **10 records per page** (Dashboard recent deliveries: strictly **5 records**).
  - Clean pagination bar with direct typed page input (`<input type="number" />`), clamping, and keyboard Enter jump.

---

## 6. Dedicated Delivery Details Page (`/deliveries/[id]`)

Replaces the legacy slide-over drawer with a full-page inspection workspace:

- **`<DeliveryNavigator />`**: Top sticky bar with "← Back to Deliveries" (preserving return context), "Previous Trip" and "Next Trip" buttons, and an auto-scrolling horizontal strip of nearby waybill pills.
- **Trip Overview Card**: Waybill number, delivery date, client name, truck specs, and late recording indicators.
- **Locations & Drop-offs Card**: Itemizes visited locations (Name, Address) with numeric drop-off counts (`dropoffCount`) and summary totals (`"Total: 2 locations, 6 stops/drop-offs"`).
- **Two-Tier Document Pane**: Separates Delivery-Level documents (trip-wide waybills, fuel slips) from Location-Level PODs.
- **Adaptive Financial Breakdown**: Shows itemized expenses for Owned trucks or single subcontractor expense for Subcontracted trucks.
