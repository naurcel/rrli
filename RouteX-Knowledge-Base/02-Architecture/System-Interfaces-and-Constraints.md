# System Interfaces and Constraints

## User interface
Web application accessed by authorized internal users using a modern browser and stable internet connection.

## Data services
- PostgreSQL via Supabase for structured records.
- Supabase Storage for POD files, with private access and server-side checks.
- Supabase Auth for production sign-in/session handling when backend configuration is
  approved. The current frontend uses a temporary preview login boundary instead.

## Explicitly absent interfaces
No live GPS/telematics, dispatch, route optimization, customer portal, automatic bank payment, BIR/tax filing, or other external integration is in current scope unless formally approved.

## Security boundaries
Browser requests must not bypass server authorization through direct URLs, route handlers, server actions, export endpoints, or storage access. Secrets must not be included in client bundles.
