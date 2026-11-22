# Redeemed Route Logistics Inc. (RRLI) — RouteX

Welcome to the **RouteX** codebase — the internal **Delivery Operations & Truck Profitability Management System** for **Redeemed Route Logistics Inc. (RRLI)**.

RouteX is designed to manage end-to-end delivery logistics, trip manifests, driver/helper crew scheduling, multi-store drop-offs, proof of delivery (POD) records, operating expenses, and truck-level financial profitability.

---

## 🚀 Repository Structure

The primary application code lives in the [`rrliRev/`](./rrliRev) directory:

```text
rrli/
├── rrliRev/                     # RouteX Next.js application workspace
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages & API route handlers
│   │   ├── components/          # Reusable RouteX UI & design system components
│   │   ├── features/            # Domain logic (deliveries, trucks, audit, finance, permissions)
│   │   └── lib/                 # Auth (Argon2id, RBAC, sessions), Supabase client, config
│   ├── docs/                    # Central knowledge base & system design documentation
│   ├── supabase/                # PostgreSQL schema migrations & RLS policies
│   └── package.json             # Application dependencies and npm scripts
└── README.md                    # Root repository overview (this file)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v20 or v24+
- **npm**: v10+

### 2. Installation & Setup

Navigate into the application folder and install dependencies:

```bash
cd rrliRev
npm install
```

### 3. Running Locally

Start the Next.js Turbopack development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Quality Assurance

RouteX enforces a strict verification contract:

```bash
# Run unit & integration test suites (360+ tests passing)
npm test

# Verify TypeScript compilation (0 errors required)
npm run typecheck

# Test production build
npm run build
```

---

## 🔑 Demo & Test Credentials

When running in local database-free preview mode, use the following seeded accounts (all passwords default to `password123`):

| Role | Username | Permissions & Access Scope |
| :--- | :--- | :--- |
| **Superadmin (President)** | `shinryu` | Unrestricted executive authority across all modules & settings |
| **Administrator** | `admin` | Full operational, financial, and user management access |
| **Operations** | `operations` | Delivery creation/edits, 3-day operational window, fleet & PODs |
| **Finance** | `finance` | View-only deliveries, truck profitability, and expense tracking |
| **HR** | `hr` | View-only fleet and crew assignment manifests |
| **Secretary** | `secretary` | View-only trip manifests and POD documents |
| **Customer Representative** | `customerrep` | View-only delivery tracking and delivery statuses |

---

## 🗄️ Architecture & Modes

### Database-Free Preview Mode (Default)
When Supabase environment variables are omitted, RouteX operates in a self-contained, browser-resilient mode:
- Verified fixture records with realistic logistics data.
- Client mutations are synchronized across tabs via custom DOM events and persisted in `localStorage`.
- Server authentication uses Argon2id password hashing and signed HttpOnly cookies.

### Supabase Connected Mode
When connected to Supabase (or deployed via Vercel integration):
- Connects to Supabase PostgreSQL using SQL migrations located in [`rrliRev/supabase/migrations/`](./rrliRev/supabase/migrations).
- Enforces Row-Level Security (RLS) policies for tenant, role, and operational boundaries.
- Uses `@supabase/ssr` with server-side cookie sessions and audit logs.

---

## 📖 Documentation & Design System

Comprehensive specifications are maintained in the documentation suite inside [`rrliRev/docs/`](./rrliRev/docs/):
- **Master Requirements & System Design**: [`docs/CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md`](./rrliRev/docs/CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md)
- **Central Knowledge Base**: [`docs/knowledge-base/`](./rrliRev/docs/knowledge-base/) (14 domain architecture and specification documents)
- **Design Tokens & System**: [`docs/design/`](./rrliRev/docs/design/) (Neumorphic styling tokens, layout hierarchy, and component conventions)
