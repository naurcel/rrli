# Environment Setup

## Current local prerequisites
- Node.js compatible with the installed Next.js 16.4.2 release.
- npm

## Deferred production prerequisites
- Supabase project and PostgreSQL database
- Supabase Auth configuration and required server-side secrets
- Supabase Storage bucket/policies for private PODs
- Deployment configuration, if confirmed

## Guardrails
- Never commit secrets or expose service-role credentials to client code.
- Use environment variables and document names without recording secret values.
- Do not assume production credentials or deployment accounts are configured.
- Database migrations and seed strategy must be selected and documented before shared environments are modified.

**TBD:** exact Node version, required environment variable names, local Supabase strategy,
migration tooling, production test accounts, and deployment environment strategy. The
current app is frontend-first with local preview data; see
[Current Implementation State](../../docs/CURRENT_IMPLEMENTATION_STATE.md).
