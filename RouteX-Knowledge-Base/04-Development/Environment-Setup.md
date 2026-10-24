# Environment Setup

## Intended prerequisites
- Node.js version compatible with the selected Next.js 15 release (pin exact version in project configuration; TBD if not already pinned).
- npm
- Supabase project and PostgreSQL database
- Auth.js configuration and required server-side secrets
- Supabase Storage bucket/policies for private PODs
- Vercel project for deployment, if confirmed

## Guardrails
- Never commit secrets or expose service-role credentials to client code.
- Use environment variables and document names without recording secret values.
- Do not assume production credentials or deployment accounts are configured.
- Database migrations and seed strategy must be selected and documented before shared environments are modified.

**TBD:** exact Node version, required environment variable names, local Supabase strategy, migration tooling, test accounts, and deployment environment strategy.
