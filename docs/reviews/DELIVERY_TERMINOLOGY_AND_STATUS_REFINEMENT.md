# RouteX: Delivery Terminology and Status Indicators Refinement Report

**Document Date:** November 16, 2026  
**Auditor / Engineer:** RouteX UI/UX System Team  
**Scope:** Deliveries section, particularly Delivery Details (`/deliveries/[id]`), store drop-off timelines, POD documents, financial breakdowns, and shared delivery components.

---

## 1. Executive Summary

This refinement aligns UI labels and status presentation across the RouteX Deliveries system with the standard terminology established in the Record Delivery form (`/deliveries/new`). Redundant status texts, duplicate section headings, and verbose badges have been replaced with subtle, accessible visual indicators (subtle amber warning icons and green check indicators) with concise tooltips and accessible screen-reader labels.

---

## 2. Terminology Simplification Mapping

The Delivery Details page now directly mirrors the established input field names:

| Current Naming | Preferred Naming | Component / File Location | Status |
|---|---|---|---|
| **Origin Hub** | **Origin** | `deliveries/[id]/page.tsx` (`detail-meta-item`) | Updated |
| **Fuel Benchmark Rate** | **Fuel Rate** | `deliveries/[id]/page.tsx` (`detail-meta-item`) | Updated |
| **Transit Distance** | **Distance** | `deliveries/[id]/page.tsx` (`detail-meta-item`) | Updated |
| **Delivery Date** | **Date** | `deliveries/[id]/page.tsx`, `confirm-delivery-deletion-dialog.tsx`, `pod-documents/page.tsx` | Updated |
| **Client Account** | **Client** | `deliveries/[id]/page.tsx`, `financial-breakdown-modal.tsx` | Updated |
| **Assigned Vehicle** | **Truck** | `deliveries/[id]/page.tsx` (card header), `confirm-delivery-deletion-dialog.tsx` | Updated |
| **Financial Status** | *Removed entirely* | `deliveries/[id]/page.tsx` (`detail-meta-item`) | Removed (redundant with the dedicated Financial Performance card) |
| **Vehicle Size** | **Type** | `delivery-truck-info-section.tsx` | Updated |
| **Cargo Temp** | **Temperature** | `delivery-truck-info-section.tsx` | Updated |

---

## 3. Status Indicator Simplification

| Area | Before | Refined Presentation | Rationale |
|---|---|---|---|
| **Donut / Pie Chart Center** | Warning triangle + duplicate text `"Incomplete"` inside the circle | Centered subtle SVG warning triangle (`#d97706`) with accessible tooltip and `<desc>` | Eliminates the duplicate `"Incomplete"` label that was immediately repeated below the chart. |
| **Donut Chart Legend** | Truncating text `"UNCONFIRMED"` (causing `"Highway T.."`) and wide `"Not applicable"` | Subtle amber icon indicator (`status-indicator-icon warning`) with tooltip `"Pending confirmation"`, and concise `"N/A"` | Prevents category labels from truncating, keeping labels legible. |
| **Itemized Expense Rows** | Repeated text `"Incomplete"` across every unconfirmed row | Subtle 18px circular warning icon (`status-indicator-icon warning`) with tooltip `"Pending confirmation"` | Reduces visual noise; communicates state clearly without text clutter. |
| **Group Subtotals** | Bulky text badge `<span class="badge-warn">Incomplete</span>` | Subtle warning indicator icon with descriptive tooltip | Standardizes subtotal indicators. |
| **Store Drop-offs Timeline** | Large green pill `✓ POD ATTACHED` on every single drop-off stop | Subtle green check indicator (`has-doc`) with accessible `title="POD attached"` | Removes repetitive status text while preserving clear positive status. |
| **Store Drop-offs Missing POD** | Heavy badge | Clean amber badge with warning icon and `"Missing POD"` | Retains clear actionable text for items requiring user upload. |
| **POD Document Cards** | Duplicate labels: `"Pending upload"` text + `"MISSING"` red badge | Clean action button: clip icon + `"Attach POD"` (or `"Pending upload"` for view-only) | Removes double-badging. |
| **Hero Status Pills** | Simple dot + text | Subtle SVG checkmark for Complete / POD Attached, and warning triangle for Incomplete / Missing POD | Provides immediate, accessible visual feedback. |

---

## 4. Redundant Information Removed

1. **Duplicate Headings & Eyebrows**:
   - In `delivery-financial-breakdown.tsx`, removed duplicate `<span className="group-eyebrow">CREW COMPENSATION</span>` which sat directly above `<h4 className="group-title">Crew Compensation</h4>`.
   - Removed `<span className="group-eyebrow">DIRECT TRANSIT</span>` above `<h4 className="group-title">Transit &amp; Facility Expenses</h4>`.
2. **Timeline Stop Headings**:
   - In `delivery-dropoff-timeline.tsx`, changed `Store Drop-off #{stopNumber}` to `Stop #{stopNumber}` since the section title already reads `Store Drop-offs ({count})` and the node icon displays the sequence number.
   - In `delivery-pod-documents.tsx`, changed `Store Drop-off #{stop.sequence}` to `Stop #{stop.sequence}`.
3. **Redundant Financial Status Item**:
   - The Trip Information card previously included a "Financial Status" item with "Complete" / "Incomplete", directly below the full-width Financial Performance card which already displays profitability, expenses, and completion status. The item was removed.
4. **Clean Currency/N/A Formatting**:
   - In `delivery-dropoff-timeline.tsx`, entry fees now display `"None"` instead of `"None (N/A)"` or `"None (₱0)"`.

---

## 5. Scope & Consistency Verification

| Page / Component | Verified Areas | Notes |
|---|---|---|
| **Delivery Details (`/deliveries/[id]`)** | Hero banner, Trip Information, Truck section, Financial Performance breakdown | 100% aligned with new naming and status icons. |
| **Store Drop-offs Timeline** | Stop headers, POD status indicators, entry fee display | Verified. |
| **POD Documents Section** | Stop labels, pending upload button, attached document preview | Verified; duplicate "MISSING" badge eliminated. |
| **Truck Info Banner** | Plate row, Classification, Type, Temperature, Provider | Verified. |
| **Deliveries Ledger (`/deliveries`)** | Column headers: Waybill, Date, Client, Truck, Temp, Origin, Drop-offs, Distance, Revenue | Already aligned with concise names. |
| **Record Delivery (`/deliveries/new`)** | Form field labels: Waybill, Date, Client, Truck plate, Temperature, Fuel rate, Origin, Distance | Baseline preserved. |
| **Deletion Dialog** | Summary rows: Date, Truck, Revenue, Drop-offs | Updated from Delivery Date / Plate Number. |
| **POD Documents Hub (`/pod-documents`)** | Inspector modal fields: Date, Destination, Client, Truck | Updated. |

---

## 6. Functional Safeguards & Verification

1. **Database Schemas & Data Model**:
   - No database column names, API schemas, or interfaces were altered.
2. **Financial Logic**:
   - Completion calculations (`isDeliveryFinanciallyComplete`, `isDeliveryIncomplete`, `resolveTripFinancialGroups`) remain untouched.
3. **Accessibility**:
   - All icon-only status indicators feature descriptive `title` attributes and `aria-label` text for assistive technologies.
4. **Theme Readability**:
   - `.status-indicator-icon` warning, success, and neutral states were styled for both Light Mode and Dark Mode with tested contrast ratios.
5. **Automated Test Results**:
   - `npm run typecheck` (`tsc --noEmit`): Passed with 0 errors.
   - `npm test`: 256/256 tests passing across 16 test suites.
   - `npm run build`: Production build completed successfully with 0 errors.

---

## 7. Remaining Exceptions & Justifications

- **Audit Logs (`/audit`)**:
  - The audit log formatter deliberately retains formal canonical names (e.g. `Client Account`, `Origin Hub`) to provide legal compliance and explicit change-tracking precision. Tests in `audit-ui.test.ts` verify these exact audit string values.
- **CSV Data Import Templates (`delivery-import-parser.ts`)**:
  - The CSV template parser supports multiple column aliases (`Waybill`, `Delivery Date`, `Client Name`, `Truck Plate`, etc.) for backward compatibility with user-submitted spreadsheets.
