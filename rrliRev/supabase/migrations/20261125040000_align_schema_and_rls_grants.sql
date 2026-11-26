-- ============================================================================
-- Migration: 20261125040000_align_schema_and_rls_grants.sql
-- RouteX: Align Database Schema Columns, Finance RLS, and PostgREST Schema Cache
--
-- Fixes:
-- 1. Add missing columns on public.user_profiles (phone_number, avatar_url,
--    backup_key_generated_at, backup_key_used_at).
-- 2. Add missing columns on public.company_expenses (transaction_type,
--    source_sheet, source_row, source_ref).
-- 3. Add public.can_write_finance() RLS helper so Finance, Admin, Superadmin,
--    and service_role can manage company_expenses.
-- 4. Grant missing read/execute permissions and notify PostgREST to reload schema cache.
-- ============================================================================

begin;

-- 1. Extend public.user_profiles with contact, avatar, and backup key metadata columns
alter table public.user_profiles
  add column if not exists phone_number text,
  add column if not exists avatar_url text,
  add column if not exists backup_key_generated_at timestamptz,
  add column if not exists backup_key_used_at timestamptz;

-- 1b. Align public.clients: ensure both client_code and code columns exist
alter table public.clients
  add column if not exists code text;

update public.clients
  set code = client_code
  where code is null and client_code is not null;

-- 2. Extend public.company_expenses with transaction direction and import metadata
alter table public.company_expenses
  add column if not exists transaction_type text not null default 'Outgoing',
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists source_ref text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_company_expenses_transaction_type'
  ) then
    alter table public.company_expenses
      add constraint chk_company_expenses_transaction_type
      check (transaction_type in ('Incoming', 'Outgoing'));
  end if;
end $$;

-- 3. Finance write authorization helper (supports Finance, Admin, Superadmin, and service_role)
create or replace function public.can_write_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and (
            up.is_superadmin = true
            or up.role in ('admin', 'finance')
            or 'admin' = any(up.roles)
            or 'finance' = any(up.roles)
          )
          and up.is_active = true
          and up.is_permanently_deleted = false
      )
    )
  );
$$;

drop policy if exists "company_expenses_insert" on public.company_expenses;
create policy "company_expenses_insert"
  on public.company_expenses
  for insert
  with check (public.can_write_finance());

drop policy if exists "company_expenses_update" on public.company_expenses;
create policy "company_expenses_update"
  on public.company_expenses
  for update
  using (public.can_write_finance())
  with check (public.can_write_finance());

drop policy if exists "company_expenses_delete" on public.company_expenses;
create policy "company_expenses_delete"
  on public.company_expenses
  for delete
  using (public.can_write_finance());

-- 4. Complete table and function grants
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role, postgres;
grant all on all sequences in schema public to service_role, postgres;
grant all on all routines in schema public to service_role, postgres;

grant select on table public.company_expenses to anon, authenticated, service_role;
grant select on table public.departments to anon, authenticated, service_role;
grant select on table public.custom_roles to anon, authenticated, service_role;
grant execute on function public.can_write_finance() to anon, authenticated, service_role;

-- 5. Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';

commit;
