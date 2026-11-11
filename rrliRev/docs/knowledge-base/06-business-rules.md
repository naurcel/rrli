# Knowledge Base: 06 — Business Rules & Financial Integrity

> **Document Status:** `[Implemented]`  
> **Authority Level:** Authoritative Specification  
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
| **"Trip Expenses"** | Formal breakdown ($Diesel + Tolls + Fees + Crew + Other$) | "delivery overhead", "stop costs" |
| **"Store Drop-offs"** / **"Drop-offs"** | Store destination lists and timeline | "stops", "waypoints", "deliveries" |
| **"Net Profit"** | Profit after all attributable expenses | "net income", "margin value" |
| **"Profit Margin"** | Net profit percentage of revenue | "margin", "markup", "profit percent" |
| **"POD Attached"** | Document uploaded and attached | "Verified", "Confirmed" |
| **"Missing POD"** | Document outstanding | "Pending Verification", "Unverified" |

---

## 2. Delivery & Trip Architecture Invariants

1. **One Delivery Equals One Completed Trip:**
   A delivery record in RouteX represents a single, complete vehicular run from origin to destination. It can contain one or more **Store Drop-offs**.
2. **No Duplication Across Drop-offs:**
   Trip Revenue and Trip Expenses belong to the overall delivery trip. They must **never** be multiplied or duplicated across individual store drop-offs.
3. **Multi-Store Sequencing:**
   Each store drop-off within a delivery has an integer sequence number ($1, 2, 3\dots$) representing the physical delivery order.
4. **Completed Operations Only:**
   RouteX is an operational accounting system for completed deliveries. Active dispatching, live GPS telematics, and in-transit tracking are outside the platform's scope.

---

## 3. Financial Integrity & Expense Resolution Rules

### A. The Unknown Expense Invariant (Zero-Tolerance)
- An expense marked with state `unknown` represents an unresolved operational liability.
- **NEVER SILENTLY ZERO AN UNKNOWN EXPENSE.**
- Deliveries containing one or more `unknown` expenses (diesel, tolls, entry fees, allowances, or other) are marked with `financialState = "incomplete"`.

### B. Exclusion from Aggregate KPI Totals
- Deliveries in the `incomplete` financial state **MUST BE STRICTLY EXCLUDED** from aggregate revenue, expense, and profit KPI calculations across the Dashboard, Truck Profitability, and Finance overviews.
- Incomplete trips are displayed in ledgers and detail views with explicit warning badges so dispatchers know they require resolution.
- Under Truck Profitability, unfinalized delivery revenue may be surfaced as a secondary `+ ₱X pending` indicator, but is never mixed into finalized earnings totals.

### C. Resolution States & Impacts

| Expense Resolution State | Internal Value | Financial Impact | Blocks Finalization? |
| :--- | :--- | :--- | :--- |
| `confirmed` | Numerical (e.g. `1500.00`) | Exact value summed into Total Expenses | No |
| `not_applicable` | `null` | Evaluates to `0.00` | No |
| `unknown` | `null` | Excluded; flags delivery as incomplete | **Yes** |

### D. Automatic Financial Resolution (No Manual Finalize Button)
There is no separate "Finalize Financials" button. Dispatchers simply click "Edit delivery" to resolve unknown expenses. Once all expense fields are confirmed or marked not applicable, the system **automatically** promotes the delivery to `finalized` status.

---

## 4. Operational Recording Windows & RBAC Boundaries

### A. Company Foundation Boundary (2024)
- RRLI was founded on **January 1, 2024**.
- No operational deliveries, expense entries, calendar date selections, report intervals, or spreadsheet imports may precede `2024-01-01`.
- Any record attempted with a date earlier than `2024-01-01` is rejected at the API and validation layer.

### B. 3-Day Submission Window for Operations
- Users with the **Operations** role are subject to a **3-day submission window** from the delivery date:
  $$\text{Current Date} - \text{Delivery Date} \le 3 \text{ days}$$
- Trips submitted past this boundary are flagged as `recording_delayed = true`.
- **System Admin** users are exempt from the 3-day restriction and can record or edit trips back to the `2024-01-01` foundation boundary.

### C. Tripartite RBAC Governance Model
RouteX operates under three core role-based access control tenets:
1. **Admin Superuser Authority (EVERYTHING):** The System Administrator has unrestricted write access across all operational modules (deliveries, drop-offs, trucks, drivers, helpers, PODs, Excel staged batch import, company expenses) and holds exclusive authority over Additional Admin Features (User Account Provisioning, Role Assignments, Audited Record Deletion, System Audit Logs, Custom Report Template Management, and Unlimited Historical Delivery Recording).
2. **Finance Dedicated Scope (Finance Page ONLY):** Finance Officers have write authority exclusively on `/finance` (`finance:manage` to record, edit, and delete company operating expenses). In all other modules (Deliveries, Fleet Trucks, Drivers & Helpers, PODs, User Management, Templates), Finance is strictly read-only.
3. **The Rest Are View-Only (With Dispatch Exception):**
   - **Operations:** Write access for daily logistics dispatch and execution (record and edit completed deliveries within the 3-day window, manage drop-offs, upload POD files, manage fleet specifications, execute Excel imports). Strictly view-only on the Finance page and excluded from all Additional Admin Features.
   - **View-Only Staff (HR, Secretary, Customer Representative):** 100% read-only across the entire platform. Zero mutation authority anywhere. Cannot record or edit deliveries, expenses, trucks, or users.

---

## 5. Profitability Calculation Formulas

### A. Delivery Trip Profitability
$$\text{Total Trip Expenses} = \text{Diesel} + \text{Tolls} + \text{Entry Fees} + \text{Driver Daily Rate} + \text{Driver Allowance} + \text{Helper Daily Rate} + \text{Helper Allowance} + \text{Other}$$

$$\text{Delivery Net Profit} = \text{Delivery Revenue} - \text{Total Trip Expenses}$$

$$\text{Profit Margin (\%)} = \left(\frac{\text{Delivery Net Profit}}{\text{Delivery Revenue}}\right) \times 100$$

### B. Truck Profitability (Strict Isolation)
$$\text{Truck Revenue} = \sum \text{Finalized Delivery Revenue for Plate Number}$$

$$\text{Truck Expenses} = \sum \text{Finalized Trip Expenses for Plate Number}$$

$$\text{Truck Net Profit} = \text{Truck Revenue} - \text{Truck Expenses}$$

> [!IMPORTANT]
> Truck profitability is strictly isolated from company-wide operating expenses. General corporate expenses must never be allocated to individual trucks.

### C. Consolidated Company Profitability
$$\text{Company Net Profit} = \text{Total Delivery Revenue} - \text{Total Delivery Expenses} - \text{Total Company Expenses}$$

$$\text{Company Profit Margin (\%)} = \left(\frac{\text{Company Net Profit}}{\text{Total Delivery Revenue}}\right) \times 100$$
