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

1. **Terminology:** Revenue (never "rate" or "sales"), Expenses (never "overhead"), Locations & numeric Stops/Drop-offs (derived total stops; never individual stop records), Net Profit, Profit Margin.
2. **Delivery & Fleet:** One delivery = one trip; Locations have name/address and numeric drop-off counts. Unregistered truck plates are auto-registered during import with available data/defaults.
3. **Crew Rules:** Unique Employee ID (`employeeCode`), format `Name [Employee ID] · Role`, drivers can be helpers, 1 driver + 1-2 helpers, no duplicate assignment on trip, same-date conflict warnings, manual daily rates (no auto labor calculations). Permanent employee deletion preserves historical delivery attribution.
4. **Owned vs Subcontracted:** Owned trucks track itemized expenses + general delivery notes; Subcontracted trucks track a single total subcontractor expense.
5. **Financial Integrity:** Never silently zero an unknown expense! Deliveries with unknown expenses are marked `incomplete` and excluded from dashboard KPI totals.
6. **Finance & Duplicates:** Single total amount entry at `/finance`. 6-sheet finance import treats records as completed historical activity (Incoming/Outgoing); duplicates across sheets are flagged for manual review (`Combine`, `Keep Separate`, `Exclude`).
7. **Backdating Requests:** Operations recording past 3 days submits a Backdating Request for Admin authorization.
8. **Truck Profitability:** Isolated from company-wide expenses. Only evaluates trip revenues and trip expenses for that specific plate number.
9. **Styling Rules:** Single global stylesheet in `src/app/globals.css`. Never use CSS Modules (`*.module.css`). Zero button shadows.
10. **Layout Shell:** `(workspace)/layout.tsx` is the sole provider of `<OperationalSidebar />` and `.app-shell`. Page components only render `<OperationalTopbar />` and `<div className="content-wrap">`.
11. **Strict Restrictions:** **DO NOT RUN `git commit`, `git push`, or deploy without explicit user authorization.**

---

## Test Credentials (Preview Mode)

Password for all: `password123`
- `admin` (System Administrator - Full Access across all modules & admin features)
- `operations` (Delivery Operations - 3-day window; view-only on Finance)
- `finance` (Finance Officer - Finance page write access; view-only elsewhere)
- `hr` (HR Specialist - View-only)
- `secretary` (Corporate Secretary - View-only)
- `customerrep` (Customer Support - View-only)
