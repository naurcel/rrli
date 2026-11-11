# Knowledge Base: 03 — Technology Stack

> **Document Status:** `[Implemented]`  
> **Authority Level:** Authoritative Specification  
> **Last Verified:** November 2026  
> **Location:** `rrliRev/docs/knowledge-base/03-technology-stack.md`

---

## 1. Core Framework & Runtime Technologies

RouteX is built entirely on modern web standards with strict type safety, zero legacy CSS module dependencies, and built-in testing.

| Layer | Technology | Version | Purpose & Responsibility |
| :--- | :--- | :--- | :--- |
| **Application Framework** | **Next.js** | `16.4.2` | Full-stack App Router, React Server Components, Route Handlers, middleware, static site generation. |
| **UI Library** | **React** | `19.3.0` | Declarative UI rendering, hooks (`useState`, `useMemo`, `useCallback`, `useTransition`), Suspense boundaries. |
| **Language** | **TypeScript** | `^5.0` | Strict static typechecking (`tsc --noEmit`), zero implicit `any`, exhaustive union pattern matching. |
| **Styling Foundation** | **Tailwind CSS** | `^4.0` | Baseline utility resets, coupled with RouteX custom semantic CSS design system in `src/app/globals.css`. |
| **Database** | **PostgreSQL (Supabase)** | `15+` | Relational persistence, Row-Level Security (RLS), foreign key integrity, atomic functions. |
| **Database Clients** | `@supabase/supabase-js`, `@supabase/ssr` | `^2.118`, `^0.12` | Server-side and browser Supabase communication, cookie-based session extraction. |
| **Schema Validation** | **Zod** | `^4.6.7` | Input parsing, form validation, runtime payload validation. |
| **Cryptography** | Node.js `crypto` | Built-in | Argon2id password and security question hashing, HMAC-SHA256 session token signing. |
| **Test Runner** | Node.js Test Runner | Built-in | Native unit & integration testing via `node --test --experimental-strip-types`. |

---

## 2. Directory Structure & Workspace Boundaries

All active RouteX code lives in `rrliRev/`. The parent directory is an archive.

```
rrliRev/
├── .github/                       # CI/CD workflows and automated checks
├── docs/                          # Comprehensive technical documentation
│   ├── knowledge-base/            # Authoritative RouteX Knowledge Base (this directory)
│   ├── design/                    # Design system, tokens, layout specifications
│   └── reviews/                   # Implementation reports, audits, and checklists
├── public/                        # Static assets, fonts, icons, truck images
├── src/
│   ├── app/                       # Next.js App Router routes & API endpoints
│   │   ├── (workspace)/           # Authenticated application workspace routes
│   │   │   ├── dashboard/         # Dashboard metrics & attention-needed
│   │   │   ├── deliveries/        # Delivery ledger, details, record, import
│   │   │   ├── drivers/           # Drivers & helpers crew registry
│   │   │   ├── finance/           # Company expenses ledger & net profit
│   │   │   ├── pod-documents/     # Centralized POD repository & viewer
│   │   │   ├── reports/           # Daily Trip Report & customizable reports
│   │   │   ├── settings/          # Profile-centered settings page
│   │   │   ├── truck-profitability/# Fleet profiles, photos, and performance
│   │   │   └── user-management/   # Administrative user accounts & audit logs
│   │   ├── api/                   # Server-side Route Handlers
│   │   ├── login/                 # Sign-in and authentication portal
│   │   ├── globals.css            # Canonical global stylesheet (no CSS modules!)
│   │   └── layout.tsx             # Root layout with theme initialization script
│   ├── components/                # Reusable presentation and layout components
│   ├── features/                  # Domain-specific business logic & stores
│   │   ├── audit/                 # System audit trail formatting & events
│   │   ├── dashboard/             # Dashboard KPI aggregations & ranking
│   │   ├── deliveries/            # Delivery calculations, repository, mock database
│   │   ├── finance/               # Company expense domain & repository
│   │   ├── reports/               # Multi-template reporting engine & CSV export
│   │   └── users/                 # Profile photos & account operations
│   └── lib/                       # Low-level utilities & infrastructure
│       ├── audit/                 # Server audit logging store
│       ├── auth/                  # RBAC, password policy, session tokens
│       ├── config/                # Environment variable parsing & validation
│       ├── format.ts              # Currency, date, and percentage formatters
│       └── supabase/              # Supabase server client factory
├── supabase/                      # PostgreSQL migrations & database seeds
│   └── migrations/                # Versioned SQL migration files
├── AGENTS.md                      # AI agent operating manual & strict rules
├── CLAUDE.md                      # AI assistant quick reference manual
├── package.json                   # Project manifest & test runner configuration
├── tsconfig.json                  # TypeScript strict compiler configuration
└── README.md                      # Developer onboarding & quick start
```

---

## 3. Tooling & Development Commands

All npm commands must be executed strictly from the `rrliRev/` directory:

```powershell
# 1. Run all unit and integration test suites (222+ tests)
cd rrliRev
npm test

# 2. Strict TypeScript typechecking (must exit with code 0)
npm run typecheck

# 3. Compile Next.js production build using Turbopack
npm run build

# 4. Start local development server on http://localhost:3000
npm run dev
```

---

## 4. Key Architectural Invariants

1. **No CSS Modules:** Next.js 16 Turbopack in this repository requires a single global stylesheet ([`src/app/globals.css`](file:///c:/Users/suchi/Documents/rrli/rrliRev/src/app/globals.css)). Never create `*.module.css` files.
2. **Zero Button Shadows:** Buttons rely on clean semantic background colors, borders, and subtle upward hover translation, rather than dropshadows.
3. **No External Network Dependencies for Preview:** RouteX must always start cleanly without internet access, third-party CDNs, or live database connections.
