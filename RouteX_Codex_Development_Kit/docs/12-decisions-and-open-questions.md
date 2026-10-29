# Decisions and Open Questions

This is a living register. Add the owner, status, decision, date, and impacted files when a question is resolved. Do not quietly treat a proposal as an approved rule.

## Status definitions
- **Open**: no approved decision.
- **Proposed**: a recommendation exists but is not approved.
- **Approved**: explicitly confirmed by the responsible owner.
- **Blocked**: implementation depends on this decision.
- **Not applicable**: confirmed out of scope.

## Decision register

| ID | Topic | Current state | Why it matters | Owner / approver | Status |
|---|---|---|---|---|---|
| D-001 | Actual repository stack and conventions | Live stack verified as Next.js 16.4.2, React 19.3.0, TypeScript, and Tailwind CSS 4; Blueprint v1 proposes Supabase Auth/PostgreSQL/Storage, `@supabase/ssr`, Zod, and Vercel | Prevents incompatible implementation | Project owner / developer | Proposed |
| D-002 | Canonical delivery fields and statuses | Must verify approved requirements | Drives forms, filters, and eligibility | Operations / owner | Open |
| D-003 | POD requirements, upload policy, and retention | Not fully defined | Affects storage, completion, and compliance | Operations / owner | Open |
| D-004 | Truck fields and retirement behavior | Not fully defined | Preserves historical reporting | Operations / owner | Open |
| D-005 | Delivery revenue/cost categories | Must use approved definitions | Drives profitability | Finance / owner | Open |
| D-006 | Additional-hour fee rate and trigger | Example ₱500/hour is not universal | Prevents incorrect billing | Finance / owner | Open |
| D-007 | Additional-drop fee rules | Not fully defined | Affects delivery totals | Finance / owner | Open |
| D-008 | Company-level expense categories | Not fully defined | Prevents double deductions | Finance / owner | Open |
| D-009 | Overhead allocation | No allocation approved here | Changes truck profitability | Finance / owner | Open |
| D-010 | HR compensation fields/rates/periods | Not fully defined | Affects costs and sensitive data | HR / owner | Open |
| D-011 | Correction, void, reversal, and audit policy | Not fully defined | Preserves financial history | Finance / owner | Open |
| D-012 | Final role permission matrix | Partially discussed, not approved | Prevents privilege errors | Project owner | Open |
| D-013 | Corporate Secretary permissions | Not defined | Role must not receive guessed access | Project owner | Open |
| D-014 | Report catalog, formats, and audiences | Not fully defined | Prevents unauthorized/incorrect reports | Owner / Finance | Open |
| D-015 | Dashboard metrics and default period | Not fully defined | Prevents fabricated or misleading KPIs | Owner / Finance | Open |
| D-016 | Timezone, date boundaries, and currency rounding | Must confirm | Affects reconciliation | Finance / owner | Open |
| D-017 | Account lifecycle and session policy | Supabase email/password sign-in, server-verified route protection, and current-device sign-out are implemented; duration, recovery, invitations, suspension, and account administration remain undefined | Affects security | Admin / owner | Open |
| D-018 | Audit log retention and backups | Not fully defined | Affects recovery and accountability | Owner / administrator | Open |
| D-019 | Styling preferences and theme support | Direction documented in style guide | Affects shared tokens and component design | Product owner | Proposed |
| D-020 | Deployment and release workflow | Must inspect current repo/process | Prevents accidental release | Project owner | Open |

## Decision record template
For each decision, record:
- ID:
- Question:
- Options considered:
- Decision:
- Rationale:
- Approver:
- Date:
- Impacted modules/files:
- Tests or migration required:
- Follow-up:
