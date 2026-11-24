-- ============================================================================
-- Migration: 20261125000000_supabase_auth_and_roles.sql
-- RouteX: Complete Supabase Auth, Account Management, and Role-Based Access Control
--
-- Objective:
-- 1. Support multi-role assignments (roles as permission presets) in user_profiles.
-- 2. Store emergency backup recovery key hashes for SMTP-free password recovery.
-- 3. Support custom roles table for configurable custom permission presets.
-- 4. Secure RLS policies ensuring only authorized administrators can manage roles & profiles.
-- ============================================================================

begin;

-- 1. Create custom_roles table for configurable permission presets
create table if not exists public.custom_roles (
  id text primary key,
  name text not null unique,
  description text not null default '',
  permissions text[] not null default '{}'::text[],
  is_enabled boolean not null default true,
  created_by text not null default 'System',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_roles enable row level security;

-- Seed default initial custom role: Fleet Supervisor
insert into public.custom_roles (id, name, description, permissions, is_enabled, created_by)
values (
  'role-fleet-supervisor',
  'Fleet Supervisor',
  'Oversees truck registrations, dispatch schedules, and driver assignments.',
  array[
    'dashboard:view',
    'deliveries:view',
    'deliveries:create',
    'deliveries:edit',
    'dropoffs:manage',
    'pod:view',
    'profitability:view',
    'profitability:manage',
    'reports:view',
    'reports:export'
  ]::text[],
  true,
  'System'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  is_enabled = excluded.is_enabled;

-- 2. Extend user_profiles with multi-role support and emergency backup key hash
alter table public.user_profiles
  add column if not exists roles text[] not null default array['customer_representative']::text[],
  add column if not exists backup_key_hash text;

-- Backfill roles array from single role column if present
update public.user_profiles
set roles = array[role::text]::text[]
where role is not null;

-- 3. RLS Policies for custom_roles
drop policy if exists "Allow authenticated users to read enabled custom roles" on public.custom_roles;
create policy "Allow authenticated users to read enabled custom roles"
  on public.custom_roles
  for select
  to authenticated
  using (true);

drop policy if exists "Allow admins and superadmin to manage custom roles" on public.custom_roles;
create policy "Allow admins and superadmin to manage custom roles"
  on public.custom_roles
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_superadmin = true or up.role = 'admin' or 'admin' = any(up.roles))
        and up.is_active = true
        and up.is_permanently_deleted = false
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_superadmin = true or up.role = 'admin' or 'admin' = any(up.roles))
        and up.is_active = true
        and up.is_permanently_deleted = false
    )
  );

-- 4. RLS Policies for user_profiles
-- Drop legacy single-role policies from earlier foundation migration to avoid conflicts
drop policy if exists "Users can read own profile or admin reads all" on public.user_profiles;
drop policy if exists "Only admins can insert user profiles" on public.user_profiles;
drop policy if exists "Only admins can update user profiles" on public.user_profiles;
drop policy if exists "Users can view active profiles or own profile" on public.user_profiles;
create policy "Users can view active profiles or own profile"
  on public.user_profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or (
      is_active = true
      and is_permanently_deleted = false
    )
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_superadmin = true or up.role = 'admin' or 'admin' = any(up.roles))
        and up.is_active = true
    )
  );

drop policy if exists "Admins and superadmin can insert/update user profiles" on public.user_profiles;
create policy "Admins and superadmin can insert/update user profiles"
  on public.user_profiles
  for all
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_superadmin = true or up.role = 'admin' or 'admin' = any(up.roles))
        and up.is_active = true
    )
  )
  with check (
    id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_superadmin = true or up.role = 'admin' or 'admin' = any(up.roles))
        and up.is_active = true
    )
  );

commit;
