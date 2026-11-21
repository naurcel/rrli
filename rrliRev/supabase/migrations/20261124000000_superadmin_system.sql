-- ============================================================================
-- RouteX Superadmin (President) System & Dynamic Department Permission Foundation
-- ============================================================================

begin;

-- 1. Extend user_profiles with Superadmin, Designation, Custom Permissions, and Deletion tracking
alter table public.user_profiles
  add column if not exists is_superadmin boolean not null default false,
  add column if not exists designation text,
  add column if not exists is_permanently_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_reason text,
  add column if not exists deleted_by text,
  add column if not exists custom_grants text[] not null default '{}'::text[],
  add column if not exists custom_restrictions text[] not null default '{}'::text[];

-- 2. Database Constraint: Exactly ONE Superadmin can exist in RouteX
create unique index if not exists unique_superadmin_idx
  on public.user_profiles (is_superadmin)
  where (is_superadmin = true);

-- 3. Departments Table
create table if not exists public.departments (
  id text primary key,
  name text not null,
  description text not null default '',
  default_permissions text[] not null default '{}'::text[],
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.departments enable row level security;

-- 4. User Department Memberships (Many-to-Many)
create table if not exists public.user_department_memberships (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  department_id text not null references public.departments(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, department_id)
);

alter table public.user_department_memberships enable row level security;

-- 5. Helper Function: is_superadmin
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.is_superadmin = true
      and up.is_active = true
      and up.is_permanently_deleted = false
  );
$$;

-- 6. Row Level Security Policies for Superadmin & Departments
create policy "Superadmin full access to departments"
  on public.departments
  for all
  to authenticated
  using (public.is_superadmin() or not is_archived)
  with check (public.is_superadmin());

create policy "Superadmin full access to user_department_memberships"
  on public.user_department_memberships
  for all
  to authenticated
  using (public.is_superadmin() or user_id = auth.uid())
  with check (public.is_superadmin());

-- 7. Seed standard baseline departments
insert into public.departments (id, name, description, default_permissions)
values
  ('admin', 'Administration', 'System administration, user access, and enterprise configurations.', array['deliveries:view', 'deliveries:create', 'deliveries:edit', 'deliveries:delete', 'deliveries:export', 'trucks:view', 'trucks:manage', 'rates:view', 'rates:manage', 'finance:view', 'finance:export', 'analytics:view', 'users:manage', 'audit:view']),
  ('operations', 'Operations', 'Dispatch, delivery scheduling, truck coordination, and proof-of-delivery.', array['deliveries:view', 'deliveries:create', 'deliveries:edit', 'deliveries:delete', 'deliveries:export', 'trucks:view', 'trucks:manage', 'rates:view', 'rates:manage', 'analytics:view']),
  ('finance', 'Finance & Billing', 'Financial reconciliation, billings, and revenue performance.', array['deliveries:view', 'deliveries:export', 'rates:view', 'rates:manage', 'finance:view', 'finance:export', 'analytics:view']),
  ('hr', 'Human Resources', 'Personnel records, staffing, and compliance.', array['deliveries:view', 'deliveries:export', 'trucks:view', 'analytics:view', 'users:manage']),
  ('secretary', 'Executive Secretariat', 'Documentation, reports, and administrative support.', array['deliveries:view', 'deliveries:export', 'trucks:view', 'rates:view', 'finance:view', 'analytics:view']),
  ('customer_representative', 'Customer Service', 'Client communications, order tracking, and delivery status verification.', array['deliveries:view'])
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  default_permissions = excluded.default_permissions;

commit;
