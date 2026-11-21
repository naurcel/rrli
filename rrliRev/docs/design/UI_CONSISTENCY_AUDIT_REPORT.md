# RouteX UI Design Consistency Audit Report

> **Document Role:** Record of observed visual inconsistencies, styling divergences, and layout misalignments across the RouteX frontend for future resolution.  
> **Status:** `[Documented for Future Task · No UI Code Modified]`  
> **Date of Audit:** November 2026  
> **Master Reference:** [`DESIGN_PHILOSOPHY.md`](./DESIGN_PHILOSOPHY.md)

---

## 1. Executive Summary

This report documents visual inconsistencies, conflicting component styles, and layout discrepancies identified during the comprehensive frontend design audit of RouteX. In accordance with the documentation-first directive, **no application code or CSS was modified**. These findings serve as an actionable backlog for future frontend refinement tasks.

---

## 2. Identified Inconsistencies & Recommendations

### 2.1 Action Button Styling Variations
- **Observed Discrepancy:**
  - Page-level primary actions use `.primary-action-button` (`min-height: 40px`, gradient background, bold white text).
  - Creation/edit form submit buttons sometimes use `.primary-button` (`min-height: 40px`, solid background).
  - Table action buttons in queues use `.export-btn-approve` (`height: 28px`, amber background) and `.export-btn-reject` (`height: 28px`, red text with border).
  - In certain modals, buttons use inline `style={{ padding: "4px 12px", fontSize: "12px" }}` or `.secondary-button` variants.
- **Future Recommendation:** Standardize button variants across the workspace into a shared button token set (`btn-primary`, `btn-secondary`, `btn-outline-danger`, `btn-table-action`).

### 2.2 Status Badges vs. Legacy Pills
- **Observed Discrepancy:**
  - The standard `.routex-badge` component (`tone-primary`, `tone-success`, `tone-warning`, `tone-danger`, `tone-purple`, `tone-neutral`) provides minimal, understated status pills (`min-height: 20px; font-size: 10.5px; border-radius: 5px`).
  - Some legacy views still use specialized badge classes: `.detail-status.success` (`border-radius: 999px; background: #e2f5ec`), `.pod-status.attached` (`6px` dot indicator), `.export-status-pill`, and `.settings-readonly-pill`.
- **Future Recommendation:** Migrate legacy badge classes (`.detail-status`, `.fleet-status`, `.report-status`) to the canonical `.routex-badge` token classes.

### 2.3 Date Filter Placement Differences
- **Observed Discrepancy:**
  - On `/dashboard` and `/reports`, the `<GlobalDateRangePicker />` is mounted inside the sticky `<OperationalTopbar />` header slot (`.topbar-filter-slot`).
  - On `/deliveries` and `/pod-documents`, the date picker is mounted inside the table's `.filters` toolbar directly alongside the `.search-box`, while `OperationalTopbar` renders with `showDateFilter={false}`.
- **Future Recommendation:** Standardize date picker placement across all views—either consistently in the topbar or consistently within the table toolbar—to provide predictable spatial muscle memory.

### 2.4 Border Radius Inconsistencies
- **Observed Discrepancy:**
  - Base control radius token is `--radius-control: 7px`, and base card radius is `--radius-card: 10px`.
  - However, buttons vary between `6px`, `8px`, `12px`, and `14px`.
  - Inputs vary between `7px` (`.search-box`), `13px` (`.preview-create-form input`), and `14px` (`.login-form-wrap input`).
  - Modal dialogs use `16px`.
- **Future Recommendation:** Align radius scale to a strict 4-tier system: `5px` (badges/tags), `8px` (controls/inputs/buttons), `12px` (cards/tables), and `16px` (modal dialogs).

### 2.5 Table Column Widths & Scrollbar Behavior
- **Observed Discrepancy:**
  - Deliveries ledger uses fluid column sizing inside `.table-wrap` (`min-width: 1100px`).
  - The Approval Queue table on `/reports` uses fixed table layout (`table-layout: fixed; min-width: 1040px`).
  - Recent Deliveries on the Dashboard uses `table-layout: fixed; min-width: 680px`.
- **Future Recommendation:** Document and enforce consistent column min-widths for standard entities (Date: `120px`, Waybill: `130px`, Plate: `120px`, Status: `110px`, Financials: `120px–140px`) across all workspace tables.

### 2.6 Orphaned / Legacy CSS Classes in `globals.css`
- **Observed Discrepancy:**
  - `src/app/globals.css` contains legacy rules for decommissioned views: `/fleet/new`, `/transactions/new`, `.delivery-stepper` (wizard step circles), and `.record-detail-drawer` width reservations.
- **Future Recommendation:** Perform a dead-code elimination pass in `globals.css` during a future frontend maintenance task to remove rules for non-existent routes and discarded drawer patterns.

---

## 3. Checklist for Future Frontend Polish Task

- [ ] Unify button classes to use canonical tokens and remove ad-hoc inline styles.
- [ ] Migrate all inline status badges to `.routex-badge`.
- [ ] Align date range picker placement across views.
- [ ] Harmonize control border radii to `--radius-control: 8px`.
- [ ] Clean up orphaned legacy classes in `globals.css`.
