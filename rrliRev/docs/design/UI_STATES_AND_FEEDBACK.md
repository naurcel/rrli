# RouteX UI States and Feedback

> **Document Role:** Visual patterns for status indicators, validation feedback, empty states, loading indicators, and attention alerts in RouteX.  
> **Master Philosophy:** [`DESIGN_PHILOSOPHY.md`](./DESIGN_PHILOSOPHY.md)  
> **Last Verified & Audited:** November 2026

---

## 1. Centralized Status Badges (`.routex-badge`)

RouteX standardizes all status pills using the compact `.routex-badge` component:

```tsx
<span className="routex-badge tone-success">Completed</span>
<span className="routex-badge tone-warning">Incomplete</span>
<span className="routex-badge tone-danger">Rejected</span>
<span className="routex-badge tone-primary">Cold Chain</span>
<span className="routex-badge tone-purple">Superadmin</span>
<span className="routex-badge tone-neutral">Dry Cargo</span>
```

### Visual Specifications
- **Dimensions:** Minimum height `20px`, padding `2px 6px`, border radius `5px`.
- **Typography:** `10.5px`, font-weight `600`, uppercase, letter-spacing `0.02em`.
- **Contrast & Restraint:** Subtle translucent backgrounds with matching light borders and high-contrast text. Tables remain calm and scannable without loud, saturated colors.

---

## 2. Attention Needed & Operational Alerts

Displayed in the scrollable **Attention Needed** section on `/dashboard` and banner notices:

- **Missing POD Alert:**
  - Identifies trips completed with missing signed receipts.
  - Border: Soft amber `#fef3c7`. Text: Deep amber `#92400e`.
  - Action link: One-click jump to `/pod-documents` filtered by that waybill.
- **Unresolved Financials Alert:**
  - Highlights deliveries with `unknown` expenses.
  - Action: "Edit financials" to prompt dispatchers to confirm numbers.
- **Schedule Conflict Warnings:**
  - Displayed inline during crew assignment when an employee is already booked on another waybill on the same date:
    ```tsx
    <div className="schedule-conflict-warning">
      ⚠️ Schedule Conflict: Danilo Cruz [DRV-01] is already assigned to Waybill #WB-2026-004 on this date.
    </div>
    ```

---

## 3. Search & Loading Feedback

- **Search Buffer Indicator (`.search-buffer-indicator`):**
  - Appears inside the search box while the user is typing, indicating that the query is debouncing before executing the filter.
- **Card Loading State (`.is-loading`):**
  - Cards and tables apply a subtle opacity reduction (`opacity: 0.65`) and non-blocking pulse during data fetches.
- **Progressive Table Skeletons:**
  - Displays placeholder rows with shimmering bone-gray lines during initial data retrieval, preventing sudden layout shifts.

---

## 4. Empty States (`.empty-cell` & `.empty-state`)

When search queries, filters, or date ranges return zero results:
- Container: Centered layout with generous vertical padding (`32px`–`48px`).
- Text: Neutral muted gray (`var(--color-text-muted)`), font size `13px`.
- Helpful Action: Includes a "Clear filters" or "Reset date range" button to quickly restore visible records.
