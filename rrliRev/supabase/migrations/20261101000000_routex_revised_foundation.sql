-- ============================================================================
-- RouteX (Revised Scope): Authentication, RBAC & Delivery Operations Foundation
-- Focus: Delivery Operations, Multi-Store Drop-offs, POD Verification & Truck Profitability
-- ============================================================================

begin;

-- 1. Roles & Access Level Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'admin',
      'operations',
      'finance',
      'hr',
      'secretary',
      'customer_representative'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'access_level') then
    create type public.access_level as enum (
      'admin',
      'operations',
      'view_only'
    );
  end if;
end
$$;

-- 2. User Profiles Table (Authoritative Server-Side Role Source)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.app_role not null default 'customer_representative',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- 3. Trusted Database Authorization Functions
create or replace function public.map_role_to_access_level(p_role public.app_role)
returns public.access_level
language sql
immutable
as $$
  select case
    when p_role = 'admin' then 'admin'::public.access_level
    when p_role = 'operations' then 'operations'::public.access_level
    else 'view_only'::public.access_level
  end;
$$;

create or replace function public.get_my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select up.role
  from public.user_profiles up
  where up.id = auth.uid()
    and up.is_active = true
  limit 1;
$$;

create or replace function public.get_my_access_level()
returns public.access_level
language sql
stable
security definer
set search_path = public
as $$
  select public.map_role_to_access_level(up.role)
  from public.user_profiles up
  where up.id = auth.uid()
    and up.is_active = true
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() = 'admin', false);
$$;

create or replace function public.can_write_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() in ('admin', 'operations'), false);
$$;

create or replace function public.can_read_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_my_role() is not null;
$$;

-- RLS Policies for user_profiles
drop policy if exists "Users can read own profile or admin reads all" on public.user_profiles;
create policy "Users can read own profile or admin reads all"
  on public.user_profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Only admins can insert user profiles" on public.user_profiles;
create policy "Only admins can insert user profiles"
  on public.user_profiles
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Only admins can update user profiles" on public.user_profiles;
create policy "Only admins can update user profiles"
  on public.user_profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Core Domain Foundation Tables (Aligned with Daily Trip Report Reference)

-- 4a. Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_code text unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "Authenticated active staff can view clients"
  on public.clients for select to authenticated
  using (public.can_read_operations());

create policy "Admin and Operations can manage clients"
  on public.clients for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

-- 4b. Trucks
create table if not exists public.trucks (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  truck_type text not null,              -- e.g. 4-Wheeler, 6-Wheeler, 10-Wheeler
  truck_temperature text not null default 'Chilled / Frozen', -- e.g. Ambient, Chilled, Frozen, Multi-Temp
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trucks enable row level security;

create policy "Authenticated active staff can view trucks"
  on public.trucks for select to authenticated
  using (public.can_read_operations());

create policy "Admin and Operations can manage trucks"
  on public.trucks for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

-- 4c. Deliveries (Completed Trip Records with Itemized Daily Trip Report Financials)
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  waybill_number text not null unique,
  delivery_date date not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  truck_id uuid not null references public.trucks(id) on delete restrict,
  truck_type_snapshot text not null,
  truck_temperature_snapshot text,
  origin text not null,
  distance_km numeric(10, 2) not null default 0 check (distance_km >= 0),
  fuel_rate numeric(10, 2) not null default 0 check (fuel_rate >= 0),
  diesel_expenses numeric(12, 2) not null default 0 check (diesel_expenses >= 0),
  toll_gate_expenses numeric(12, 2) not null default 0 check (toll_gate_expenses >= 0),
  toll_gate_breakdown text,
  entry_fees numeric(12, 2) not null default 0 check (entry_fees >= 0),
  driver_allowance numeric(12, 2) not null default 0 check (driver_allowance >= 0),
  driver_daily_rate numeric(12, 2) not null default 0 check (driver_daily_rate >= 0),
  helper_allowance numeric(12, 2) not null default 0 check (helper_allowance >= 0),
  helper_daily_rate numeric(12, 2) not null default 0 check (helper_daily_rate >= 0),
  other_expenses numeric(12, 2) not null default 0 check (other_expenses >= 0),
  total_expenses numeric(12, 2) generated always as (
    diesel_expenses +
    toll_gate_expenses +
    entry_fees +
    driver_allowance +
    driver_daily_rate +
    helper_allowance +
    helper_daily_rate +
    other_expenses
  ) stored,
  delivery_rate numeric(12, 2) not null check (delivery_rate >= 0),
  net_income numeric(12, 2) generated always as (
    delivery_rate - (
      diesel_expenses +
      toll_gate_expenses +
      entry_fees +
      driver_allowance +
      driver_daily_rate +
      helper_allowance +
      helper_daily_rate +
      other_expenses
    )
  ) stored,
  pod_status text not null default 'Pending' check (pod_status in ('Verified', 'Incomplete', 'Pending')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deliveries enable row level security;

create policy "Authenticated active staff can view deliveries"
  on public.deliveries for select to authenticated
  using (public.can_read_operations());

create policy "Admin and Operations can create and update deliveries"
  on public.deliveries for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

-- 4d. Delivery Store Drop-offs (Multi-Store Drop-offs within One Delivery Trip)
create table if not exists public.delivery_dropoffs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  store_name text not null,
  destination_area text,
  entry_fee numeric(12, 2) not null default 0 check (entry_fee >= 0),
  pod_submitted boolean not null default false,
  supporting_docs_complete boolean not null default false,
  remarks text,
  created_at timestamptz not null default now(),
  unique (delivery_id, sequence_number)
);

alter table public.delivery_dropoffs enable row level security;

create policy "Authenticated active staff can view delivery dropoffs"
  on public.delivery_dropoffs for select to authenticated
  using (public.can_read_operations());

create policy "Admin and Operations can manage delivery dropoffs"
  on public.delivery_dropoffs for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

-- 4e. Excel Import Batches & Staged Review Rows (Never Saved Without Review)
create table if not exists public.excel_import_batches (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  storage_path text,
  status text not null default 'pending_review' check (status in ('pending_review', 'confirmed', 'cancelled')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  imported_by uuid not null references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.excel_import_batches enable row level security;

create policy "Authenticated active staff can view import batches"
  on public.excel_import_batches for select to authenticated
  using (public.can_read_operations());

create policy "Admin and Operations can manage import batches"
  on public.excel_import_batches for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

commit;

