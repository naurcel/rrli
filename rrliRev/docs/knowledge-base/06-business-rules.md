# Knowledge Base: 06 — Business Rules & Financial Integrity

> **Document Status:** `[Authoritative Rules]`  
> **Authority Level:** Authoritative Specification  
> **Master Source of Truth:** [`../CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md`](../CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md)  
> **Last Verified:** November 2026  
> **Location:** `rrliRev/docs/knowledge-base/06-business-rules.md`

---

## 1. Canonical Terminology Standards

RouteX enforces standard business language across all UI elements, database columns, and reports:

| Canonical Term | Acceptable Context | Strictly Prohibited Synonyms |
| :--- | :--- | :--- |
| **"Revenue"** | Standard UI (cards, table headers, badges) | "rate", "billing", "sales", "gross revenue" |
| **"Delivery Revenue"** | Formal reports, legal documents, contracts | "billing amount", "gross sales" |
| **"Expenses"** | Standard UI (cards, table headers, badges) | "operational costs", "fleet overhead" |
| **"Trip Expenses"** | Formal breakdown (Diesel + Tolls + Crew + Other) | "delivery overhead", "stop costs" |
| **"Locations"** | Stores, branches, or depots visited | "waypoints", "deliveries" |
| **"Stops / Drop-offs"** | Numeric count of drop-offs at a location | "stopovers", "deliveries" |
| **"Net Profit"** | Profit after all attributable expenses | "net income", "margin value" |
| **"Profit Margin"** | Net profit percentage of revenue | "margin", "markup", "profit percent" |
| **"POD Attached"** | Document uploaded and attached | "Verified", "Confirmed" |
| **"Missing POD"** | Document outstanding | "Pending Verification", "Unverified" |
| **"Requests"** | Backdating request queue and modal | "Tickets", "Backdating Tickets" |

---

## 2. Delivery & Trip Architecture Invariants

1. **One Delivery Equals One Completed Trip:**
   - A delivery record in RouteX represents a single, complete vehicular run from origin to destination.
   - It is identified by a unique Waybill Number (`waybillNumber`), Delivery Date, Client, and Truck.
2. **Locations and Numeric Stop Counts (No Individual Stop Records):**
   - A delivery can have one or more **Locations**.
   - Each Location stores:
     - Location Name
     - Location Address
     - Numeric count of stops/drop-offs (`dropoffCount`)
   - **Do not create individual stop/drop-off records**, forms, or database rows.
   - The total stop/drop-off count is derived as the sum across locations:
     $$\text{Total Stops / Drop-offs} = \sum_{i=1}^{N} \text{Location}_i.\text{dropoffCount}$$
3. **No Revenue/Expense Duplication Across Locations:**
   - Trip Revenue and Trip Expenses belong to the overall delivery trip. They must **never** be multiplied across locations.
4. **Completed Operations Only:**
   - RouteX is an operational accounting system for completed deliveries. Active dispatching, live GPS telematics, and in-transit tracking are outside scope.

---

## 3. Fleet & Truck Registration Rules

1. **Plate Matching:** Every delivery is attributed to a registered truck by plate number.
2. **Automatic Truck Registration on Import:**
   - If an imported spreadsheet contains a plate number not present in the truck registry, the system **automatically registers the truck** using available spreadsheet details.
   - Missing fields remain blank or use appropriate defaults.
   - The import does not require additional truck information or pre-registration to proceed.
3. **Ownership Differentiation:**
   - **Owned Trucks:** Complete operational tracking (diesel, tolls, crew pay, itemized expenses).
   - **Subcontracted Trucks:** Distinguished by spreadsheet structure/formatting (unshaded/white cells). Simplified financial structure (single subcontractor expense amount).

---

## 4. Employee Identification & Crew Assignment Rules

1. **Unique Employee ID/Code:**
   - Every driver and helper has a unique, non-null Employee ID (`employeeCode`, e.g., `DRV-01`, `HLP-01`).
2. **Crew Dropdown Display Format:**
   - Dropdown options display: `Name [Employee ID] · Role`.
3. **Cross-Role Flexibility:**
   - Drivers are selectable as helpers on delivery trips.
4. **Crew Quotas per Delivery:**
   - Exactly **one (1) Driver** per delivery.
   - **One to two (1–2) Helpers** per delivery (minimum 1, maximum 2).
5. **Conflict Prevention:**
   - **Same Delivery:** An employee cannot be assigned to multiple roles on the same trip.
   - **Same Date:** An employee cannot be assigned to multiple delivery trips on the same calendar date. The UI surfaces a schedule conflict warning if an employee is already booked.
6. **Manual Daily Rates:**
   - Daily rates and allowances are entered manually per trip. No automated labor cost calculations.
7. **Permanent Deletion & Historical Integrity:**
   - Deleting an employee removes them from active lists and future dropdowns, but **preserves their name and attribution in all historical deliveries and audit logs**.

---

## 5. Expense Tracking & Financial Integrity Invariants

### A. Owned vs. Subcontracted Expense Interfaces
- **Owned Trucks:** Itemized expense entries (`description` + `amount`) with Add/Remove rows, plus **one general delivery notes field** (`notes`). No per-expense notes.
- **Subcontracted Trucks:** **One total subcontractor expense amount** (`subcontractorExpense`). Itemized fuel and crew daily rates are omitted.

### B. The Unknown Expense Invariant (Zero-Tolerance)
- An expense marked `unknown` represents an unresolved operational liability.
- **NEVER SILENTLY ZERO AN UNKNOWN EXPENSE.**
- Deliveries containing one or more `unknown` expenses are marked `financialState = "incomplete"`.

### C. Exclusion from Aggregate KPI Totals
- Deliveries in the `incomplete` financial state **MUST BE STRICTLY EXCLUDED** from aggregate revenue, expense, and profit KPI calculations across the Dashboard, Truck Profitability, and Finance overviews until finalized.
- Incomplete trips display warning badges indicating that financial resolution is required.

### D. Automatic Financial Resolution
- There is no separate "Finalize Financials" button. Dispatchers simply edit the delivery to confirm unknown amounts; the system automatically promotes the delivery to `finalized`.

---

## 6. Operational Recording Windows & Backdating Requests

1. **Company Foundation Boundary (2024):**
   - RRLI was founded on **January 1, 2024**. No records may precede `2024-01-01`.
2. **3-Day Operational Window for Operations:**
   - Operations staff can record or edit deliveries up to 3 days from the delivery date:
     $$\text{Today} - \text{Delivery Date} \le 3 \text{ days}$$
   - Any trip recorded past 3 days requires an **Approved Backdating Request**.
3. **Backdating Requests Queue:**
   - Operations submits a request with Waybill, Date, Client, Plate, and Reason.
   - System Admin reviews and approves or rejects the request.
   - System Admin is exempt from the 3-day restriction.

---

## 7. Finance Spreadsheet Import Rules

1. **All Six Sheets Supported:** Billings, Petty Cash, Checks Received, Payables, Checks Issued, Collections.
2. **Core Data Ingestion:** Extracts **Date**, **Total Amount**, and **Description/Subject**, classified strictly as **Incoming** or **Outgoing** (no pending status).
3. **Duplicate Record Review:**
   - Cross-sheet matching records are flagged for **Manual Review**.
   - Records are never merged automatically.
   - Reviewers select: **Combine Records**, **Keep Separate**, or **Exclude Record**.

---

## 8. Documents & Proof of Delivery (POD)

1. **Two-Tier Association:**
   - **Delivery-Level Documents:** Attached to the overall trip (Master Waybill, Fuel Slip).
   - **Location-Level Documents:** Attached to a specific Location (Store POD, stamped invoice).
   - **No individual stop records** are created solely for document association.
2. **Storage Architecture (`[Planned Backend]`):**
   - Private Supabase Storage bucket (`routex-documents`) with 5-minute pre-signed URLs.

---

## 9. Profitability Formulas

### A. Owned Delivery Profitability
$$\text{Total Trip Expenses} = \sum \text{Itemized Expenses (Diesel, Tolls, Crew Rates, Allowances, Other)}$$
$$\text{Delivery Net Profit} = \text{Delivery Revenue} - \text{Total Trip Expenses}$$
$$\text{Profit Margin (\%)} = \left(\frac{\text{Delivery Net Profit}}{\text{Delivery Revenue}}\right) \times 100$$

### B. Subcontracted Delivery Profitability
$$\text{Delivery Net Profit} = \text{Delivery Revenue} - \text{Subcontractor Expense}$$
$$\text{Profit Margin (\%)} = \left(\frac{\text{Delivery Net Profit}}{\text{Delivery Revenue}}\right) \times 100$$

### C. Truck Profitability (Strict Isolation)
$$\text{Truck Revenue} = \sum \text{Finalized Delivery Revenue for Truck Plate}$$
$$\text{Truck Expenses} = \sum \text{Finalized Trip Expenses for Truck Plate}$$
$$\text{Truck Net Profit} = \text{Truck Revenue} - \text{Truck Expenses}$$
> [!IMPORTANT]
> Company-wide operating expenses are never allocated to individual trucks.

### D. Consolidated Company Profitability
$$\text{Company Net Profit} = \sum \text{Delivery Revenue} - \sum \text{Trip Expenses} - \sum \text{Company Operating Expenses}$$
$$\text{Company Profit Margin (\%)} = \left(\frac{\text{Company Net Profit}}{\sum \text{Delivery Revenue}}\right) \times 100$$
