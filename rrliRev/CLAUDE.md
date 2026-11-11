# RouteX (`rrliRev`) — Claude & AI Assistant Quick Reference

> **AUTHORITATIVE DIRECTIVE:**  
> All active development, code changes, and tests occur strictly within `rrliRev/`. The parent repository root is an archive. Read [`AGENTS.md`](./AGENTS.md) and [`docs/knowledge-base/`](./docs/knowledge-base/) for deep domain context.

---

## Quick Reference Commands

All commands run from `rrliRev/`:

```powershell
npm test             # Run 222+ tests across 16 suites (100% pass required)
npm run typecheck    # Strict TypeScript verification (code 0 required)
npm run build        # Compile Next.js production bundle with Turbopack
npm run dev          # Start local development server on port 3000
```

---

## Critical Invariants

1. **Terminology:** Revenue (never "rate" or "sales"), Expenses (never "overhead"), Store Drop-offs / Drop-offs (never "stops"), Net Profit, Profit Margin.
2. **Financial Integrity:** Never silently zero an unknown expense! Deliveries with unknown expenses are marked `incomplete` and excluded from dashboard KPI totals.
3. **Company Expenses:** Single total amount entry at `/finance` without tags or distribution. Evaluates to Company Net Profit.
4. **Truck Profitability:** Isolated from company-wide expenses. Only evaluates trip revenues and trip expenses for that specific plate number.
5. **Styling Rules:** Single global stylesheet in `src/app/globals.css`. Never use CSS Modules (`*.module.css`). Zero button shadows.
6. **Layout Shell:** `(workspace)/layout.tsx` is the sole provider of `<OperationalSidebar />` and `.app-shell`. Page components only render `<OperationalTopbar />` and `<div className="content-wrap">`.
7. **Strict Restrictions:** **DO NOT RUN `git commit`, `git push`, or deploy without explicit user authorization.**

---

## Test Credentials (Preview Mode)

Password for all: `password123`
- `admin` (System Administrator - Full Access across all modules & admin features)
- `operations` (Delivery Operations - 3-day window; view-only on Finance)
- `finance` (Finance Officer - Finance page write access; view-only elsewhere)
- `hr` (HR Specialist - View-only)
- `secretary` (Corporate Secretary - View-only)
- `customerrep` (Customer Support - View-only)
