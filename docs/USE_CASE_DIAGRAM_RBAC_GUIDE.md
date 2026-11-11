# RouteX: Role-Based Access Control (RBAC) & Use Case Diagram Reference Guide
**Project:** RouteX — Logistics Delivery Operations & Truck Profitability Management System  
**Client / Domain Organization:** Redeemed Route Logistics Inc. (RRLI)  
**Target Audience:** Systems Analyst / UI-UX Designer / Software Engineering Groupmate  
**Document Purpose:** Complete specification of Actors, Roles, Permissions, Use Cases, and UML Relationships to construct an accurate and compliant **Use Case Diagram**.

---

## 1. System Overview & Scope Boundaries

RouteX is a centralized logistics web application designed specifically for **Redeemed Route Logistics Inc. (RRLI)** to monitor completed delivery trips, audit financial revenue and expenses, manage cold chain (refrigerated) and ambient fleet vehicles, verify proof-of-delivery (POD) documentation, and generate operational summaries.

### System Boundaries & Invariants
* **In Scope:**
  - Completed delivery records and multi-store drop-off tracking.
  - Granular financial breakdown (revenue, fuel, tolls, driver/helper rates, allowances, entry fees, miscellaneous, net profit, margin).
  - Truck fleet management (Owned 4/6/10-wheelers, Subcontracted fleets, cold storage vs. dry cargo capabilities).
  - Staged Excel spreadsheet bulk importation and validation.
  - Digital Proof of Delivery (POD) document viewing (images, PDFs) and attachment.
  - Custom report template authoring and CSV/Excel data export.
  - User identity lifecycle, Argon2id security, password recovery, and immutable audit logging.
* **Out of Scope & Critical Governance Boundaries:**
  - **No Live GPS / Dispatching:** RouteX is an operations ledger and profitability auditor, not a real-time driver GPS tracking tool.
  - **Admin Deletion Authority with Mandatory Confirmation Screen:** Administrators are authorized to make deletion decisions (e.g. deleting delivery records, deleting trucks, deleting custom report templates, and removing staff accounts). Every deletion decision strictly requires an explicit confirmation screen/modal before execution, accompanied by immutable audit event logging. Non-admin roles (Operations, Finance, HR, Secretary, Customer Rep) have zero deletion authority.
  - **No Open Self-Registration:** All system accounts are provisioned by an Administrator; guest users cannot register themselves.

---

## 2. Actors & Role Hierarchy

A Use Case Diagram requires clearly identified **Actors** (human or external systems interacting with the system) and their **generalization / inheritance** relationships.

### 2.1 The Six Canonical User Roles

RouteX implements **6 Canonical Business Roles** mapped into **3 Tiered Access Levels**:

| Role Name | Access Level | UI Label & Badge Tone | Primary Business Purpose & Domain Responsibilities |
| :--- | :--- | :--- | :--- |
| **`admin`** | **Admin** (`admin`) | `Admin` <br>*(Primary / Green)* | Full system administration, user account management, role assignment, credential resets, audit log inspection, report template customization, and full operational write capabilities. |
| **`operations`** | **Operations** (`operations`) | `Operations` <br>*(Primary / Green)* | Daily logistics operations: creating/editing deliveries, recording multi-store drop-offs, uploading and reviewing Excel bulk trips, attaching/replacing POD files, registering fleet trucks, and exporting reports. |
| **`finance`** | **View-Only** (`view_only`) | `Finance` <br>*(Neutral)* | Financial auditing: inspects trip revenues, operational expenses (fuel, tolls, helper pay), profit margins, truck profitability rankings, and financial reports. |
| **`hr`** | **View-Only** (`view_only`) | `HR` <br>*(Neutral)* | Personnel auditing: inspects delivery records, driver and helper crew assignments, daily trip wage rates, and meal allowances to prepare payroll summaries. |
| **`secretary`** | **View-Only** (`view_only`) | `Secretary` <br>*(Neutral)* | Operational compliance: monitors delivery completion, ensures POD documents are attached and complete, checks waybill status, and reviews company reports. |
| **`customer_representative`** | **View-Only** (`view_only`) | `Customer Rep` <br>*(Neutral)* | Customer service inquiry: inspects client delivery waybills, store drop-off timelines, delivery dates, and POD receipt verification to resolve customer claims. |

### 2.2 Unauthenticated & Secondary Actors

* **`Guest / Unauthenticated User`**: Any visitor accessing the public route (`/login`). Can submit credentials to log in, complete first-login setup, or perform password self-recovery.
* **`System Audit Logger` (Secondary / Supporting Actor)**: Automated background subsystem that intercepts administrative mutations and records immutable attribute transitions (old vs. new values).

### 2.3 Actor Generalization Hierarchy (UML Inheritance)

In UML Use Case Diagrams, you can reduce clutter by modeling **Actor Inheritance**:

```mermaid
classDiagram
    direction BT
    
    class GuestUser["Guest / Unauthenticated User"]
    class AuthenticatedUser["Authenticated User (Base Actor)"]
    class ViewOnlyUser["View-Only Staff (Generalization)"]
    class OperationsUser["Operations Coordinator"]
    class AdminUser["System Administrator"]
    
    class Finance["Finance Officer"]
    class HR["HR Officer"]
    class Secretary["Corporate Secretary"]
    class CustomerRep["Customer Representative"]
    
    AuthenticatedUser <|-- ViewOnlyUser
    AuthenticatedUser <|-- OperationsUser
    OperationsUser <|-- AdminUser
    
    ViewOnlyUser <|-- Finance
    ViewOnlyUser <|-- HR
    ViewOnlyUser <|-- Secretary
    ViewOnlyUser <|-- CustomerRep
```

* **Inheritance Rules:**
  - `View-Only Staff` inherits all general viewing capabilities (`Dashboard`, `Deliveries`, `PODs`, `Trucks`, `Reports`, `Settings`).
  - `Finance`, `HR`, `Secretary`, and `Customer Representative` are concrete specializations of `View-Only Staff` (they share the same system permissions, but represent distinct organizational goals).
  - `Operations Coordinator` inherits viewing capabilities and adds write/mutation capabilities for operational modules.
  - `System Administrator` inherits all `Operations` capabilities and adds administrative privileges (`User Management`, `Audit Logs`, `Template Authoring`).

---

## 3. Comprehensive Use Case Catalog by Subsystem

Below is the complete list of system use cases, their descriptions, primary actors, and UML relationships (`<<include>>` or `<<extend>>`).

### Subsystem 1: Identity & Access Management (IAM)

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-01** | **Log In** | Guest User | — | Authenticate into RouteX using username/email and password. |
| **UC-02** | **Complete First-Login Setup** | Authenticated User | `<<extend>>` UC-01 *(Condition: temporary password assigned)* | Mandatory workflow on first login: set a new permanent password and register security questions. |
| **UC-03** | **Recover Password via Security Question** | Guest User | `<<extend>>` UC-01 *(Condition: user forgot password)* | Self-service password recovery by answering the predefined security question. |
| **UC-04** | **Manage Account Profile** | Authenticated User | `<<include>>` UC-01 | User updates own display name, username, password, or uploads profile picture avatar. |
| **UC-05** | **Log Out** | Authenticated User | `<<include>>` UC-01 | Terminate the active session and invalidate HMAC-SHA256 session cookie. |

---

### Subsystem 2: Delivery Operations & Trip Management

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-06** | **View Delivery Ledger** | View-Only Staff, Operations, Admin | `<<include>>` UC-01 | View completed delivery records in a tabular ledger with pagination and financial totals. |
| **UC-07** | **Search & Filter Deliveries** | View-Only Staff, Operations, Admin | `<<include>>` UC-06 | Filter deliveries by global date range, client, truck plate, driver, or POD attachment status; sort via 3-state sort controls. |
| **UC-08** | **View Delivery Details Drawer** | View-Only Staff, Operations, Admin | `<<include>>` UC-06 | Open the detailed slide-out drawer to view trip overview, crew, vehicle specs, drop-offs, and financial breakdown. |
| **UC-09** | **Create Delivery Record** | Operations, Admin | `<<include>>` UC-01, `<<include>>` UC-10, `<<include>>` UC-11 | Register a new delivery trip manually. |
| **UC-10** | **Record Multi-Store Drop-off Sequence** | Operations, Admin | `<<include>>` UC-09, `<<include>>` UC-12 | Specify ordered destination stores, drop-off locations, and individual delivery quantities. |
| **UC-11** | **Assign Vehicle & Crew** | Operations, Admin | `<<include>>` UC-09, `<<include>>` UC-12 | Select truck plate (owned/subcontracted), assign driver, and assign up to two helpers with respective wage rates. |
| **UC-12** | **Edit Delivery Record** | Operations, Admin | `<<include>>` UC-08 | Modify operational or financial attributes of an existing delivery. |
| **UC-13** | **Calculate Trip Financials & Margin** | System / Automated | `<<include>>` UC-09, `<<include>>` UC-12 | Automatically compute revenue, total expenses, net income, and profit margin percent. |
| **UC-13B** | **Delete Delivery Record** | Admin | `<<include>>` UC-08, `<<include>>` UC-35 | Permanently delete an invalid delivery record via an audited confirmation screen. |

---

### Subsystem 3: Batch Staging & Excel Bulk Import

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-14** | **Upload Excel Trip File** | Operations, Admin | `<<include>>` UC-01 | Upload `.xlsx` / `.csv` spreadsheet containing multiple delivery trip rows into the staging environment. |
| **UC-15** | **Review & Validate Staged Deliveries** | Operations, Admin | `<<include>>` UC-14 | Inspect parsed rows, check for missing fields, rate anomalies, or unrecognized truck plates prior to saving. |
| **UC-16** | **Confirm & Commit Batch Import** | Operations, Admin | `<<include>>` UC-15 | Atomically commit validated staging rows into the active delivery database. |

---

### Subsystem 4: Proof of Delivery (POD) & Document Management

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-17** | **View Proof of Delivery (POD)** | View-Only Staff, Operations, Admin | `<<include>>` UC-08 | View attached POD files (high-resolution PNG/JPG receipts or embedded PDF documents). |
| **UC-18** | **Download POD File** | View-Only Staff, Operations, Admin | `<<include>>` UC-17 | Download the original signed delivery receipt or invoice document. |
| **UC-19** | **Upload / Replace POD Document** | Operations, Admin | `<<extend>>` UC-17 *(Condition: missing or updated document)* | Attach or update a digital POD file against a delivery stop. |

---

### Subsystem 5: Fleet & Truck Profitability Analytics

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-20** | **View Fleet & Profitability Grid** | View-Only Staff, Operations, Admin | `<<include>>` UC-01 | Review owned truck cards and subcontracted fleet vehicles with aggregated net profits and performance KPIs. |
| **UC-21** | **Filter & Rank Trucks** | View-Only Staff, Operations, Admin | `<<include>>` UC-20 | Filter by cargo storage capability (Refrigerated/Cold Chain vs. Dry Cargo), wheel count, or performance tier; rank by profit, revenue, or margin. |
| **UC-22** | **View Truck Operational Profile** | View-Only Staff, Operations, Admin | `<<include>>` UC-20 | View dedicated truck profile page containing specifications, vehicle photo, revenue history, and assigned trip log. |
| **UC-23** | **Register / Update Truck Information** | Operations, Admin | `<<include>>` UC-01 | Register a new truck plate, define classification, ownership (Owned/Subcon), cargo capability, and upload vehicle image. |

---

### Subsystem 6: Company Expense Ledger & Company Profitability (Finance Module)

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-23B** | **View Company Expense Ledger** | View-Only Staff, Operations, Admin | `<<include>>` UC-01 | View company expense ledger records, total company expenses, search by description, filter by date, and sort by date or amount. |
| **UC-23C** | **Record Company Expense** | Operations, Admin | `<<include>>` UC-01 | Record an overall company operating expense (office, rent, utilities, general overhead) with description, positive PHP amount, date, and optional notes without allocating to specific trips or trucks. |
| **UC-23D** | **Edit Company Expense** | Operations, Admin | `<<include>>` UC-23B | Update description, amount, date, or notes of an existing company expense record. |
| **UC-23E** | **Delete Company Expense** | Admin | `<<include>>` UC-23B, `<<include>>` UC-35 | Permanently delete a company expense record via an audited confirmation modal. |

---

### Subsystem 7: Operational & Financial Reporting

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-24** | **Generate Operational Reports** | View-Only Staff, Operations, Admin | `<<include>>` UC-01 | View structured reports across built-in layouts: Client Summary, Truck Summary, or Trip Ledger. |
| **UC-25** | **Filter Report by Global Date Range** | View-Only Staff, Operations, Admin | `<<include>>` UC-24 | Recompute report totals dynamically using date presets (Today, This Week, This Month, All Time) or custom dates. |
| **UC-26** | **Export Report to CSV / Excel** | Operations, Admin | `<<include>>` UC-24 | Export RFC 4180-compliant CSV containing metadata, active filters, column headings, and calculated summary totals. |
| **UC-27** | **Print / Save Report as PDF** | View-Only Staff, Operations, Admin | `<<include>>` UC-24 | Open clean browser print dialogue optimized for formal paper or PDF archiving. |
| **UC-28** | **Author Custom Report Template** | Admin | `<<extend>>` UC-24 *(Condition: Admin customizes layout)* | Customize column visibility, display labels, ordering, and aggregation groupings. |
| **UC-29** | **Delete Custom Report Template** | Admin | `<<include>>` UC-28, `<<include>>` UC-35 | Delete user-created templates via an audited confirmation screen (built-in system default templates cannot be deleted). |

---

### Subsystem 8: User Administration & System Auditing

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-30** | **View User Directory** | Admin | `<<include>>` UC-01 | View list of system staff, assigned roles, email addresses, and account status (`Active` vs. `Inactive`). |
| **UC-31** | **Provision New User Account** | Admin | `<<include>>` UC-30 | Create account with temporary credentials and assign canonical role. |
| **UC-32** | **Modify User Role & Status** | Admin | `<<include>>` UC-30 | Change staff role assignment or toggle active status (soft-disable without deleting records). |
| **UC-32B** | **Delete User Account** | Admin | `<<include>>` UC-30, `<<include>>` UC-35 | Permanently delete staff user account (preventing primary admin self-deletion) via an audited confirmation screen. |
| **UC-33** | **Reset User Password (Admin-Assisted)** | Admin | `<<include>>` UC-30 | Issue temporary password to unlock an account when user forgets security question answers. |
| **UC-34** | **Inspect System Audit Logs** | Admin | `<<include>>` UC-30 | View audit trail capturing security events, credential updates, and record diffs showing old vs. new state changes. |

---

### Subsystem 9: Critical Confirmation & Governance

| UC ID | Use Case Name | Primary Actor | Relationships & Triggers | Brief Description |
| :--- | :--- | :--- | :--- | :--- |
| **UC-35** | **Confirm Critical Deletion Decision** | Admin | `<<included by>>` UC-13B, UC-23E, UC-29, UC-32B | Present an explicit modal confirmation screen displaying entity details and destructive warnings before executing permanent deletion. |

---

## 4. RBAC Permissions Matrix (CRUD & Execution Mapping)

This matrix maps system permissions directly to the **6 Canonical Roles**:

| Module / Permission Key | Code Identifier | Admin | Operations | Finance | HR | Secretary | Customer Rep |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | | | | | | | |
| View Dashboard & KPIs | `dashboard:view` | ✅ | ✅ | 👁 (Read) | 👁 (Read) | 👁 (Read) | 👁 (Read) |
| **Deliveries** | | | | | | | |
| View Delivery Ledger & Details | `deliveries:view` | ✅ | ✅ | 👁 (Read) | 👁 (Read) | 👁 (Read) | 👁 (Read) |
| Create New Delivery | `deliveries:create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit Existing Delivery | `deliveries:edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Delivery Record | `deliveries:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Complete / Finalize Trip | `deliveries:complete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Store Drop-offs | `dropoffs:manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Excel Batch Staging** | | | | | | | |
| Upload Excel File | `imports:upload` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Review & Confirm Import | `imports:review_confirm` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Proof of Delivery (POD)** | | | | | | | |
| View & Download POD | `pod:view` | ✅ | ✅ | 👁 (Read) | 👁 (Read) | 👁 (Read) | 👁 (Read) |
| Upload / Replace POD | `deliveries:edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Fleet & Profitability** | | | | | | | |
| View Trucks & Profitability | `profitability:view` | ✅ | ✅ | 👁 (Read) | 👁 (Read) | 👁 (Read) | 👁 (Read) |
| Register / Edit Trucks & Photos | `profitability:manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Company Expenses (Finance)** | | | | | | | |
| View Expense Ledger & Totals | `finance:view` | ✅ | ✅ | 👁 (Read) | 👁 (Read) | 👁 (Read) | 👁 (Read) |
| Record & Edit Company Expenses | `finance:manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Company Expense Record | `finance:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reports** | | | | | | | |
| View Report Document Previews | `reports:view` | ✅ | ✅ | 👁 (Read) | 👁 (Read) | 👁 (Read) | 👁 (Read) |
| Export Reports to CSV/Excel | `reports:export` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Author / Delete Custom Templates | `reports:manage_templates`| ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Administration & IAM** | | | | | | | |
| View User Accounts Directory | `users:view` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Accounts, Roles & Resets | `users:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete User Account | `users:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Audit Logs & Transitions | `users:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Settings Page | `settings:view` | ✅ | ✅ | 👁 (Read) | 👁 (Read) | 👁 (Read) | 👁 (Read) |
| Manage System Configuration | `settings:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Legend:**  
> - **✅ Full Access:** Can view, execute, create, edit, or submit changes.  
> - **👁 Read Only:** Can view data, filter, search, and inspect drawers; mutation controls are hidden and server-blocked (HTTP 403).  
> - **❌ Prohibited:** Action and navigation route are completely inaccessible.

---

## 5. Ready-to-Use Mermaid UML Diagram

Your groupmate can paste this code directly into markdown viewers, GitHub, or Mermaid Live Editor (`mermaid.live`):

```mermaid
flowchart LR
    %% Actors
    subgraph Actors["System Actors"]
        Guest["fa:fa-user Guest User"]
        ViewOnly["fa:fa-eye View-Only Staff\n(Finance / HR / Sec / CustRep)"]
        Ops["fa:fa-truck Operations Coordinator"]
        Admin["fa:fa-shield-halved System Administrator"]
    end

    %% System Boundary
    subgraph RouteX["RouteX System Boundary (Redeemed Route Logistics Inc.)"]
        
        subgraph IAM["1. Identity & Access Management"]
            UC01(["UC-01: Log In"])
            UC02(["UC-02: Complete First-Login Setup"])
            UC03(["UC-03: Recover Password via Question"])
            UC04(["UC-04: Manage Account Profile & Avatar"])
            UC05(["UC-05: Log Out"])
        end

        subgraph Deliveries["2. Delivery Operations & POD"]
            UC06(["UC-06: View Delivery Ledger & Details"])
            UC07(["UC-07: Search & Filter Deliveries"])
            UC09(["UC-09: Create Delivery Record"])
            UC10(["UC-10: Record Multi-Store Drop-offs"])
            UC11(["UC-11: Assign Vehicle & Crew"])
            UC12(["UC-12: Edit Delivery Record"])
            UC13B(["UC-13B: Delete Delivery Record"])
            UC14(["UC-14: Upload Excel Trip File"])
            UC16(["UC-16: Commit Batch Staged Import"])
            UC17(["UC-17: View POD Document"])
            UC19(["UC-19: Upload / Replace POD File"])
        end

        subgraph Fleet["3. Fleet & Truck Profitability"]
            UC20(["UC-20: View Fleet Profitability Grid"])
            UC21(["UC-21: Filter & Rank Fleet Vehicles"])
            UC22(["UC-22: View Truck Operational Profile"])
            UC23(["UC-23: Register / Edit Truck & Photo"])
        end

        subgraph FinanceSub["4. Company Expense Ledger (Finance)"]
            UC23B(["UC-23B: View Expense Ledger"])
            UC23C(["UC-23C: Record Company Expense"])
            UC23D(["UC-23D: Edit Company Expense"])
            UC23E(["UC-23E: Delete Company Expense"])
        end

        subgraph Reports["5. Operational Reports"]
            UC24(["UC-24: View Standard Reports"])
            UC26(["UC-26: Export Report to CSV"])
            UC27(["UC-27: Print / Save Report as PDF"])
            UC28(["UC-28: Author Custom Report Template"])
            UC29(["UC-29: Delete Custom Report Template"])
        end

        subgraph AdminSub["6. Administration & Audit"]
            UC30(["UC-30: View User Directory"])
            UC31(["UC-31: Provision New User Account"])
            UC32(["UC-32: Modify Role & Status"])
            UC32B(["UC-32B: Delete User Account"])
            UC33(["UC-33: Reset User Password"])
            UC34(["UC-34: Inspect Audit Logs & Diffs"])
        end

        subgraph Governance["7. Confirmation & Governance"]
            UC35(["UC-35: Confirm Critical Deletion Decision"])
        end

    end

    %% Generalization Hierarchy
    Ops -->|inherits| ViewOnly
    Admin -->|inherits| Ops

    %% Actor to Use Case Connections
    Guest --> UC01
    Guest --> UC03
    
    ViewOnly --> UC04
    ViewOnly --> UC05
    ViewOnly --> UC06
    ViewOnly --> UC07
    ViewOnly --> UC17
    ViewOnly --> UC20
    ViewOnly --> UC21
    ViewOnly --> UC22
    ViewOnly --> UC23B
    ViewOnly --> UC24
    ViewOnly --> UC27

    Ops --> UC09
    Ops --> UC12
    Ops --> UC14
    Ops --> UC16
    Ops --> UC19
    Ops --> UC23
    Ops --> UC23C
    Ops --> UC23D
    Ops --> UC26

    Admin --> UC13B
    Admin --> UC23E
    Admin --> UC28
    Admin --> UC29
    Admin --> UC30
    Admin --> UC31
    Admin --> UC32
    Admin --> UC32B
    Admin --> UC33
    Admin --> UC34

    %% Include / Extend Relationships
    UC02 -.->|«extend»| UC01
    UC03 -.->|«extend»| UC01
    UC09 -.->|«include»| UC10
    UC09 -.->|«include»| UC11
    UC12 -.->|«include»| UC10
    UC12 -.->|«include»| UC11
    UC13B -.->|«include»| UC35
    UC16 -.->|«include»| UC14
    UC19 -.->|«extend»| UC17
    UC23E -.->|«include»| UC35
    UC28 -.->|«extend»| UC24
    UC29 -.->|«include»| UC35
    UC32B -.->|«include»| UC35
```

---

## 6. Role-Specific Business Context for Use Case Narratives

If your groupmate needs to write descriptions or narrative specifications for each role, use these verified domain summaries:

### 1. Finance Officer (`finance`)
* **Why they use RouteX:** To audit delivery profitability and track overall company operating expenses without risking operational tampering.
* **Key Use Cases:** UC-06 (View Deliveries), UC-08 (Delivery Details Drawer), UC-20 (Truck Profitability Grid), UC-23B (View Company Expense Ledger), UC-24 (Client & Truck Summary Reports).
* **Specific Data Watched:** Fuel expenses, highway toll receipts, helper daily allowances, client delivery rates, revenue, total company expenses (office, rent, utilities, overhead), net profit (`Company Net Profit = Total Delivery Revenue - Total Delivery Expenses - Total Company Expenses`), profit margins, and incomplete expense flags. Note: Company expenses contribute to overall company net profit, but do not alter individual delivery margins or truck profitability.

### 2. HR Officer (`hr`)
* **Why they use RouteX:** To verify staff assignments and calculate bi-monthly crew compensation.
* **Key Use Cases:** UC-06 (Delivery Ledger), UC-08 (View Crew Details), UC-24 (Trip Ledger Report).
* **Specific Data Watched:** Driver assignments, Helper 1 and Helper 2 assignments, daily trip rates (e.g. ₱700 driver daily rate), meal allowances (e.g. ₱300), and delivery dates.

### 3. Corporate Secretary (`secretary`)
* **Why they use RouteX:** To verify organizational compliance, client contract fulfillment, and document completeness.
* **Key Use Cases:** UC-06 (Deliveries), UC-17 (View POD Documents), UC-20 (Fleet Registry), UC-24 (Operational Reports).
* **Specific Data Watched:** Stamped waybill receipts, customer signature attachments on PODs, vehicle registration plate types, and delivery dates.

### 4. Customer Representative (`customer_representative`)
* **Why they use RouteX:** To answer client delivery inquiries and resolve missing delivery disputes.
* **Key Use Cases:** UC-06 (Search Deliveries by Client/Waybill), UC-08 (Drop-off Sequence), UC-17 (View Signed POD).
* **Specific Data Watched:** Client name (e.g., Alfamart, SM Supermarket), waybill numbers, store drop-off timestamps, quantities delivered, and signed delivery receipts.

### 5. Operations Coordinator (`operations`)
* **Why they use RouteX:** Hands-on operational management of daily dispatch execution and data entry.
* **Key Use Cases:** UC-09 (Create Delivery), UC-12 (Edit Delivery), UC-10 (Drop-off stops), UC-14 (Excel Bulk Upload), UC-16 (Confirm Staged Batch), UC-19 (Upload PODs), UC-23 (Register Fleet Trucks), UC-26 (Export CSV).

### 6. System Administrator (`admin`)
* **Why they use RouteX:** System security, account provisioning, role assignment, format configuration, and accountability auditing.
* **Key Use Cases:** UC-30 through UC-34 (User Directory, Account Provisioning, Role Management, Credential Resets, Audit Logs with State Diffs), UC-28 (Custom Report Template Authoring).

---

## 7. Diagramming Best Practices & Tips for Your Groupmate

1. **Use Actor Inheritance to Keep the Diagram Clean:**  
   Instead of drawing lines from all four view-only roles (`Finance`, `HR`, `Secretary`, `Customer Rep`) to every single view use case, create a generalization actor called `View-Only Staff`. Draw arrows from `Finance`, `HR`, etc. inheriting from `View-Only Staff`, and draw single association lines from `View-Only Staff` to the viewing use cases.
2. **Proper Use of `<<include>>`:**  
   Use `<<include>>` when a use case cannot complete without another. Example: *Creating a Delivery* always includes *Recording Drop-offs* and *Assigning Crew*. The arrow points **from** the base use case **to** the included use case: `(Create Delivery) .-> <<include>> (Assign Crew)`.
3. **Proper Use of `<<extend>>`:**  
   Use `<<extend>>` for optional or conditional workflows. Example: *First-Login Setup* only happens conditionally if the account is new; *Upload POD* is an extension when viewing a delivery stop that lacks a document. The arrow points **from** the extending use case **back to** the base use case: `(Complete First-Login Setup) .-> <<extend>> (Log In)`.
4. **Tool Compatibility:**  
   This document's structure and naming conventions can be directly copied into popular modeling tools:
   - **draw.io / diagrams.net:** Standard UML Use Case stencil set.
   - **Lucidchart:** UML Use Case library.
   - **Visual Paradigm / StarUML:** Use Case Diagram view.
   - **PlantUML:** Convert the catalog above using standard `actor` and `usecase` syntax.

