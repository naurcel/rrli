# Knowledge Base: 14 — Deployment, Maintenance & Documentation Conventions

> **Document Status:** `[Implemented]`  
> **Authority Level:** Authoritative Specification  
> **Last Verified:** November 2026  
> **Location:** `rrliRev/docs/knowledge-base/14-deployment-and-maintenance.md`

---

## 1. Environment Configuration

RouteX is configured via environment variables. Copy `.env.example` to `.env.local` for local development:

```bash
# ==============================================================================
# ROUTEX APPLICATION ENVIRONMENT CONFIGURATION
# ==============================================================================

# Session Secret (Mandatory in production; minimum 32 random characters)
ROUTEX_SESSION_SECRET=your-32-char-random-hmac-secret-key-here

# Supabase PostgreSQL & Storage Connection (Optional for Browser Preview Mode)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-anon-key

# Service Role Key (Server-side administrative tasks only; NEVER expose to client!)
# SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Node Environment
NODE_ENV=production
```

> [!CAUTION]
> The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row-Level Security policies. It must never be prefixed with `NEXT_PUBLIC_` or exposed to browser bundles. RouteX includes an automated test (`src/lib/config/env.test.ts`) that asserts service role keys are never leaked to public variables.

---

## 2. Database Migrations Deployment

When connecting to a Supabase project:

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```
2. Link your remote Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
3. Apply migrations in sequential order from `rrliRev/supabase/migrations/`:
   ```bash
   supabase db push
   ```

Migration inventory:
- `20261101000000_routex_revised_foundation.sql`: Core profiles, RLS, audit logging.
- `20261101010000_stage2_delivery_management.sql`: Deliveries, store drop-offs, trucks, crew, POD storage bucket.
- `20261109000000_company_expenses.sql`: Company-wide operating expenses table, RLS policies, indexes.

---

## 3. Production Deployment Guide (Vercel)

1. **Root Directory Configuration:** Set Root Directory to `rrliRev` in Vercel project settings.
2. **Build Settings:**
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
3. **Environment Variables:** Configure `ROUTEX_SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 4. Documentation Maintenance Conventions

To maintain this Knowledge Base and keep documentation aligned with the codebase during future pull requests or AI coding tasks:

### A. Status Tag Taxonomy
Every technical document must explicitly declare one of five standard tags at the top:
- `[Implemented]`: Verified in the live codebase with automated test coverage.
- `[Agreed]`: Formally agreed architectural decision awaiting implementation.
- `[Planned]`: Roadmap feature intended for future iterations.
- `[Unverified]`: Requires source code or schema verification.
- `[Deprecated]`: Legacy or superseded implementation retained for historical reference.

### B. Updating Documentation Upon Code Changes
Whenever code or business logic is updated:
1. **Update the relevant Knowledge Base document** in `rrliRev/docs/knowledge-base/`.
2. **Update the Central Index** in `rrliRev/docs/README.md`.
3. **Update `rrliRev/AGENTS.md`** if any invariant or developer rule changed.
4. **Run Verification Gates** (`npm test`, `npm run typecheck`, `npm run build`) before signing off.

---

## 5. Troubleshooting & FAQ

### Q: Why do I see duplicate sidebars or a blank screen on a new route?
**A:** This happens if a page template re-wraps `<OperationalSidebar />` or `.app-shell`. In RouteX, `(workspace)/layout.tsx` is the sole canonical provider of the sidebar and app shell. Page components should only render `<OperationalTopbar />` and `<div className="content-wrap">`.

### Q: Why is my delivery excluded from Dashboard KPI totals?
**A:** Check if any expense field is marked `unknown` or if PODs are missing. Deliveries with unresolved liabilities are flagged `incomplete` and automatically excluded to protect financial integrity until finalized.

### Q: Why does `next build` fail with CSS errors?
**A:** Verify that no CSS Modules (`*.module.css`) were introduced. All styles must be declared directly in `src/app/globals.css`.
