# Knowledge Base: 14 — Deployment, Maintenance & Documentation Conventions

> **Document Status:** `[Authoritative Operations Specification]`  
> **Authority Level:** Authoritative Specification  
> **Master Source of Truth:** [`../CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md`](../CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md)  
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

# Supabase PostgreSQL & Storage Connection (Planned Backend; Optional for Browser Preview Mode)
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

## 2. Dual-Mode Deployment Architecture

### A. Browser Preview Mode (`[Frontend Implemented]` · `[Mock-Only]`)
- When Supabase credentials are not provided or placeholder values are detected, RouteX deploys automatically in Browser Preview Mode.
- Runs entirely on verified in-memory fixtures (`small-mock-database.ts`) and client `localStorage`.
- Ideal for instant Vercel previews, design validation, and functional testing without external database dependencies.

### B. Supabase Connected Mode (`[Planned Backend]`)
When ready for production database deployment:
1. Link remote Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
2. Apply versioned migrations in sequential order from `rrliRev/supabase/migrations/`:
   ```bash
   supabase db push
   ```
3. Configure `ROUTEX_SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the hosting environment (e.g., Vercel).

---

## 3. Production Deployment Guide (Vercel)

1. **Root Directory Configuration:** Set Root Directory to `rrliRev` in Vercel project settings.
2. **Build Settings:**
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
3. **Environment Variables:** Configure `ROUTEX_SESSION_SECRET`.

---

## 4. Documentation Maintenance Conventions

To maintain consistency and prevent documentation drift:

### A. Status Tag Taxonomy
Every document must declare its authority and implementation state:
- `[Confirmed Requirement]`: Agreed system rule.
- `[Frontend Implemented]`: Functional in UI.
- `[Mock-Only]`: Powered by local mock storage.
- `[Planned Backend]`: Designed for future Supabase implementation.
- `[Implemented Backend]`: Server logic verified in repo.
- `[Superseded]`: Retained for historical reference only.

### B. Updating Documentation Upon Requirements or Code Changes
Whenever requirements or UI behaviors evolve:
1. Update [`../CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md`](../CENTRAL_REQUIREMENTS_AND_SYSTEM_DESIGN.md) as the primary source of truth.
2. Update the relevant Knowledge Base documents in `rrliRev/docs/knowledge-base/`.
3. Update [`../README.md`](../README.md) and [`../../AGENTS.md`](../../AGENTS.md).
4. Run verification gates (`npm test`, `npm run typecheck`, `npm run build`).
