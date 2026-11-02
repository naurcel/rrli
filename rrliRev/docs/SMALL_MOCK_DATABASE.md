# Small Mock Database

RouteX includes a deliberately small, deterministic dataset for local development and disposable test environments. It is designed to exercise delivery, drop-off, POD, and profitability behavior without pretending to be production data.

## Dataset

The canonical fixture lives in `src/features/deliveries/small-mock-database.ts`.

| Record type | Count | Notes |
| --- | ---: | --- |
| Clients | 3 | LANDERS, Manila Comisario Central Inc. (MCCI), VANGUARD |
| Trucks | 3 | One 10-wheeler and two 6-wheelers |
| Drivers | 2 | Fictional personnel |
| Helpers | 2 | Fictional personnel |
| Completed deliveries | 6 | Exactly two per client |
| Drop-offs | 9 | Three single-destination trips and three two-stop trips |

All deliveries occur from June 1 through June 7, 2026. Waybills, routes, personnel, storage paths, and filenames are fictional. Sample filenames include `SAMPLE-NOT-SIGNED` so they cannot be mistaken for operational documents.

## Scenarios covered

| Date | Client | Stops | Financial/POD scenario |
| --- | --- | ---: | --- |
| June 1 | LANDERS | 1 | Normal finalized trip; POD verified |
| June 2 | LANDERS | 2 | Confirmed zero other expense; POD submitted |
| June 3 | MCCI | 1 | Entry fee explicitly not applicable; POD missing |
| June 4 | MCCI | 2 | Low but positive margin; POD rejected |
| June 5 | VANGUARD | 1 | Confirmed zero toll; POD verified |
| June 7 | VANGUARD | 2 | Unknown toll keeps finances incomplete; POD submitted |

Revenue remains trip-level. Store entry fees are derived from the delivery's child drop-offs. Total expenses, net income, and profit margin are calculated by the centralized delivery-domain functions and are checked again against database-generated values after seeding. The incomplete trip is excluded from confirmed profitability summaries.

## Seed a local or disposable test database

1. Apply these migrations in order:
   - `supabase/migrations/20261101000000_routex_revised_foundation.sql`
   - `supabase/migrations/20261101010000_stage2_delivery_management.sql`
   - `supabase/migrations/20261102000000_financial_integrity.sql`
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. For a local Supabase URL, run:

   ```powershell
   npm.cmd run seed:small-mock
   ```

For a disposable hosted test project only, also set `ROUTEX_SEED_ENV=test`. The command refuses non-local targets without that explicit marker and always refuses `NODE_ENV=production`.

Never expose the service-role key through a `NEXT_PUBLIC_*` variable, commit it, or use this seed against production.

## Safety and repeatability

- The seed uses deterministic IDs and upserts only its own records.
- It does not delete or truncate existing user data.
- Re-running it produces the same fixture instead of duplicate records.
- A dedicated technical auth user is created only to satisfy finalized-record audit foreign keys.
- The command validates fixture counts, date boundaries, per-client delivery counts, drop-offs, POD states, generated financial totals, and the profitability summary before reporting success.

The seed requires a migrated database and valid credentials, so unit tests validate the fixture without making a network connection. Live seed verification must be run against the intended disposable environment.
