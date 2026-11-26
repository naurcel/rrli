-- Permanently eliminate any RLS recursion on public.user_profiles
begin;

-- 1. Drop ALL existing policies on public.user_profiles (regardless of legacy policy names)
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
  loop
    execute format('drop policy if exists %I on public.user_profiles', pol.policyname);
  end loop;
end $$;

-- 2. Rewrite helper functions in PL/pgSQL with SECURITY DEFINER so PostgreSQL never inlines them into RLS checks
create or replace function public.can_write_operations()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and (
        up.is_superadmin = true
        or up.role in ('admin', 'operations')
        or 'admin' = any(up.roles)
        or 'operations' = any(up.roles)
      )
      and up.is_active = true
      and up.is_permanently_deleted = false
  ) into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.can_write_finance()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  select exists (
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
  ) into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

-- 3. Create clean, non-recursive RLS policies on public.user_profiles
-- Never query public.user_profiles inside user_profiles' own RLS policies!
alter table public.user_profiles no force row level security;
alter table public.user_profiles enable row level security;

create policy "user_profiles_select_all" on public.user_profiles
  for select using (true);

create policy "user_profiles_insert_self_or_service" on public.user_profiles
  for insert with check (
    current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or coalesce(auth.jwt()->>'role', '') = 'service_role'
    or id = auth.uid()
  );

create policy "user_profiles_update_self_or_service" on public.user_profiles
  for update using (
    current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or coalesce(auth.jwt()->>'role', '') = 'service_role'
    or id = auth.uid()
  )
  with check (
    current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or coalesce(auth.jwt()->>'role', '') = 'service_role'
    or id = auth.uid()
  );

create policy "user_profiles_delete_service" on public.user_profiles
  for delete using (
    current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or coalesce(auth.jwt()->>'role', '') = 'service_role'
  );

notify pgrst, 'reload schema';

commit;
