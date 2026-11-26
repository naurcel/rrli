-- ============================================================================
-- Migration: 20261126000000_routex_clean_baseline.sql
-- RouteX: Complete Consolidated Database Baseline Schema
--
-- Single authoritative schema from scratch:
-- 1. Extensions & Custom Types
-- 2. Core Tables (Departments, Custom Roles, Profiles, Clients, Trucks,
--    Employees, Deliveries, Dropoffs, Documents, Expenses, Import Batches)
-- 3. Views (delivery_ledger)
-- 4. Triggers & Auto-Reconcile Routines
-- 5. Business Logic RPCs (create_delivery_record, mutate_delivery_financials)
-- 6. RLS Policies & Grants (permits authorized operations, ensures active reads)
-- 7. Baseline System Seeding:
--    - Zero pre-seeded input records (0 trucks, 0 clients, 0 crew, 0 trips, 0 expenses)
--    - Core system departments only
-- ============================================================================

begin;

-- 1. Required Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Enumerations
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum (
      'admin', 'operations', 'finance', 'hr', 'secretary', 'customer_representative'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'access_level') then
    create type public.access_level as enum (
      'admin', 'operations', 'view_only'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'truck_type') then
    create type public.truck_type as enum (
      '4-Wheeler', '6-Wheeler', '10-Wheeler'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'storage_capability') then
    create type public.storage_capability as enum (
      'Dry', 'Chilled', 'Freezer'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'ownership_type') then
    create type public.ownership_type as enum (
      'Owned', 'Subcontracted'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'rate_basis') then
    create type public.rate_basis as enum (
      'Redeemed Rate', 'Trucker Rate'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'employee_assignment_type') then
    create type public.employee_assignment_type as enum (
      'Driver', 'Helper'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'pod_status') then
    create type public.pod_status as enum (
      'Verified', 'Incomplete', 'Pending'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type public.delivery_status as enum (
      'Completed', 'Cancelled', 'In_Transit'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'expense_resolution_status') then
    create type public.expense_resolution_status as enum (
      'confirmed', 'not_applicable', 'unknown'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'financial_state') then
    create type public.financial_state as enum (
      'incomplete', 'finalized'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum (
      'missing', 'pending_verification', 'rejected', 'verified'
    );
  end if;
end $$;

-- 3. Core System Tables

-- 3a. Departments
create table if not exists public.departments (
  id text primary key,
  name text not null,
  description text,
  default_permissions text[] not null default '{}',
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3b. Custom Roles
create table if not exists public.custom_roles (
  id text primary key,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  is_enabled boolean not null default true,
  created_by text default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3c. User Profiles
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null unique,
  normalized_username text not null unique,
  full_name text not null,
  role text not null default 'admin',
  roles text[] not null default '{"admin"}',
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  security_question text,
  security_answer_hash text,
  recovery_authorized_at timestamptz,
  recovery_authorized_by uuid,
  recovery_token_hash text,
  recovery_expires_at timestamptz,
  password_changed_at timestamptz,
  is_superadmin boolean not null default false,
  designation text,
  is_permanently_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_reason text,
  deleted_by uuid,
  custom_grants text[] default '{}',
  custom_restrictions text[] default '{}',
  backup_key_hash text,
  phone_number text,
  avatar_url text,
  backup_key_generated_at timestamptz,
  backup_key_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3d. Department Memberships
create table if not exists public.user_department_memberships (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  department_id text not null references public.departments(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, department_id)
);

-- 3e. Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_code text unique,
  code text,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3f. Client Document Requirements
create table if not exists public.client_document_requirements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  document_key text not null,
  label text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (client_id, document_key)
);

-- 3g. Trucks (Fleet)
create table if not exists public.trucks (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  truck_type text not null default '6-Wheeler',
  truck_temperature text,
  storage_capability text not null default 'Dry',
  ownership_type text not null default 'Owned',
  rate_basis text not null default 'Redeemed Rate',
  provider text,
  contact_person text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3h. Employees (Drivers & Helpers)
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  assignment_type text not null check (assignment_type in ('Driver', 'Helper')),
  contact_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3i. Deliveries (Master Trip Ledger)
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  waybill_number text not null unique,
  delivery_date date not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  truck_id uuid not null references public.trucks(id) on delete restrict,
  driver_id uuid references public.employees(id) on delete set null,
  helper_id uuid references public.employees(id) on delete set null,
  truck_type_snapshot text not null,
  truck_temperature_snapshot text,
  truck_ownership_snapshot text not null default 'Owned',
  rate_basis text not null default 'Redeemed Rate',
  origin text not null,
  distance_km numeric(10, 2) not null default 0 check (distance_km >= 0),
  fuel_rate numeric(10, 2) not null default 0 check (fuel_rate >= 0),
  diesel_expenses numeric(12, 2) not null default 0 check (diesel_expenses >= 0),
  diesel_expenses_status text not null default 'confirmed',
  toll_gate_expenses numeric(12, 2) not null default 0 check (toll_gate_expenses >= 0),
  toll_gate_expenses_status text not null default 'confirmed',
  toll_gate_breakdown text,
  entry_fees numeric(12, 2) not null default 0 check (entry_fees >= 0),
  entry_fees_status text not null default 'confirmed',
  driver_allowance numeric(12, 2) not null default 0 check (driver_allowance >= 0),
  driver_allowance_status text not null default 'confirmed',
  driver_daily_rate numeric(12, 2) not null default 0 check (driver_daily_rate >= 0),
  driver_daily_rate_status text not null default 'confirmed',
  helper_allowance numeric(12, 2) not null default 0 check (helper_allowance >= 0),
  helper_allowance_status text not null default 'confirmed',
  helper_daily_rate numeric(12, 2) not null default 0 check (helper_daily_rate >= 0),
  helper_daily_rate_status text not null default 'confirmed',
  other_expenses numeric(12, 2) not null default 0 check (other_expenses >= 0),
  other_expenses_status text not null default 'confirmed',
  delivery_rate numeric(12, 2) not null check (delivery_rate > 0),
  pod_status text not null default 'Pending',
  delivery_status text not null default 'Completed',
  version integer not null default 1,
  financial_state text not null default 'incomplete' check (financial_state in ('incomplete', 'finalized')),
  financial_finalized_at timestamptz,
  financial_finalized_by uuid references public.user_profiles(id),
  recording_delayed boolean not null default false,
  notes text,
  total_expenses numeric(12, 2) generated always as (
    coalesce(diesel_expenses, 0) +
    coalesce(toll_gate_expenses, 0) +
    coalesce(entry_fees, 0) +
    coalesce(driver_allowance, 0) +
    coalesce(driver_daily_rate, 0) +
    coalesce(helper_allowance, 0) +
    coalesce(helper_daily_rate, 0) +
    coalesce(other_expenses, 0)
  ) stored,
  net_income numeric(12, 2) generated always as (
    delivery_rate - (
      coalesce(diesel_expenses, 0) +
      coalesce(toll_gate_expenses, 0) +
      coalesce(entry_fees, 0) +
      coalesce(driver_allowance, 0) +
      coalesce(driver_daily_rate, 0) +
      coalesce(helper_allowance, 0) +
      coalesce(helper_daily_rate, 0) +
      coalesce(other_expenses, 0)
    )
  ) stored,
  profit_margin numeric(6, 2) generated always as (
    case
      when delivery_rate > 0 then
        round(
          (((delivery_rate - (
            coalesce(diesel_expenses, 0) +
            coalesce(toll_gate_expenses, 0) +
            coalesce(entry_fees, 0) +
            coalesce(driver_allowance, 0) +
            coalesce(driver_daily_rate, 0) +
            coalesce(helper_allowance, 0) +
            coalesce(helper_daily_rate, 0) +
            coalesce(other_expenses, 0)
          )) / delivery_rate) * 100)::numeric,
          2
        )
      else 0
    end
  ) stored,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3j. Store Dropoffs
create table if not exists public.delivery_dropoffs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  sequence_number integer not null,
  store_name text not null,
  destination_area text not null,
  dropoff_count integer not null default 1,
  entry_fee numeric(12, 2),
  entry_fee_status text not null default 'confirmed',
  pod_submitted boolean not null default false,
  supporting_docs_complete boolean not null default false,
  remarks text,
  delivery_status text not null default 'Completed',
  document_ref text default 'Pending upload',
  created_at timestamptz not null default now(),
  unique (delivery_id, sequence_number)
);

-- 3k. Delivery Documents
create table if not exists public.delivery_documents (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  dropoff_id uuid references public.delivery_dropoffs(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  status text not null default 'missing',
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  verification_notes text,
  uploaded_by uuid references public.user_profiles(id),
  uploaded_at timestamptz,
  verified_by uuid references public.user_profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3l. Company Expenses (General Operating Income & Expenses)
create table if not exists public.company_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null,
  category text not null,
  transaction_type text not null default 'Outgoing' check (transaction_type in ('Incoming', 'Outgoing')),
  source_sheet text,
  source_row integer,
  source_ref text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3m. Delivery Activity Log
create table if not exists public.delivery_activity (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  action text not null,
  actor_id uuid references public.user_profiles(id),
  changes jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  reason text,
  previous_version integer,
  resulting_version integer
);

-- 3n. Delivery Mutation Idempotency Tracking
create table if not exists public.delivery_mutation_requests (
  idempotency_key uuid not null,
  mutation_type text not null,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  actor_id uuid references public.user_profiles(id),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (idempotency_key, mutation_type)
);

-- 3o. Excel Import Batches & Rows
create table if not exists public.excel_import_batches (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  storage_path text,
  status text not null default 'pending',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  imported_by uuid references public.user_profiles(id),
  confirmed_by uuid references public.user_profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.excel_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.excel_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_values jsonb not null default '{}'::jsonb,
  normalized_values jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending',
  reviewed_by uuid references public.user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. Unified Delivery Ledger View
create or replace view public.delivery_ledger as
select
  d.id,
  d.waybill_number,
  d.delivery_date,
  d.recording_delayed,
  d.client_id,
  d.truck_id,
  d.driver_id,
  d.helper_id,
  d.truck_type_snapshot,
  d.truck_temperature_snapshot,
  d.truck_ownership_snapshot,
  d.rate_basis,
  d.origin,
  d.distance_km,
  d.fuel_rate,
  d.diesel_expenses,
  d.diesel_expenses_status,
  d.toll_gate_expenses,
  d.toll_gate_expenses_status,
  d.toll_gate_breakdown,
  d.entry_fees,
  d.entry_fees_status,
  d.driver_allowance,
  d.driver_allowance_status,
  d.driver_daily_rate,
  d.driver_daily_rate_status,
  d.helper_allowance,
  d.helper_allowance_status,
  d.helper_daily_rate,
  d.helper_daily_rate_status,
  d.other_expenses,
  d.other_expenses_status,
  d.total_expenses,
  d.delivery_rate,
  d.net_income,
  d.profit_margin,
  d.pod_status,
  d.delivery_status,
  d.version,
  d.financial_state,
  d.financial_finalized_at,
  d.financial_finalized_by,
  d.notes,
  d.created_by,
  d.created_at,
  d.updated_at,
  c.name as client_name,
  c.is_active as client_is_active,
  t.plate_number,
  t.truck_type,
  t.truck_temperature,
  t.storage_capability,
  t.ownership_type,
  t.rate_basis as truck_rate_basis,
  t.provider,
  t.contact_person,
  t.is_active as truck_is_active,
  drv.full_name as driver_name,
  hlp.full_name as helper_name
from public.deliveries d
left join public.clients c on c.id = d.client_id
left join public.trucks t on t.id = d.truck_id
left join public.employees drv on drv.id = d.driver_id
left join public.employees hlp on hlp.id = d.helper_id;

-- 5. Business Logic & Security Functions

-- 5a. Operations & Finance RLS Authorization Helpers
create or replace function public.can_read_operations()
returns boolean language sql stable security definer set search_path = public as $$
  select true;
$$;

create or replace function public.can_write_operations()
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
            or up.role in ('admin', 'operations')
            or 'admin' = any(up.roles)
            or 'operations' = any(up.roles)
          )
          and up.is_active = true
          and up.is_permanently_deleted = false
      )
    )
  );
$$;

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

-- 5b. Auto-Reconcile Financial State Trigger
create or replace function public.auto_reconcile_delivery_financial_state()
returns trigger language plpgsql as $$
declare
  v_has_incomplete_dropoffs boolean;
begin
  select exists (
    select 1 from public.delivery_dropoffs
    where delivery_id = new.id
      and (entry_fee_status = 'unknown' or (entry_fee_status = 'confirmed' and entry_fee is null))
  ) into v_has_incomplete_dropoffs;

  if new.diesel_expenses_status = 'unknown' or (new.diesel_expenses_status = 'confirmed' and new.diesel_expenses is null)
    or new.toll_gate_expenses_status = 'unknown' or (new.toll_gate_expenses_status = 'confirmed' and new.toll_gate_expenses is null)
    or new.entry_fees_status = 'unknown' or (new.entry_fees_status = 'confirmed' and new.entry_fees is null)
    or new.driver_allowance_status = 'unknown' or (new.driver_allowance_status = 'confirmed' and new.driver_allowance is null)
    or new.driver_daily_rate_status = 'unknown' or (new.driver_daily_rate_status = 'confirmed' and new.driver_daily_rate is null)
    or new.helper_allowance_status = 'unknown' or (new.helper_allowance_status = 'confirmed' and new.helper_allowance is null)
    or new.helper_daily_rate_status = 'unknown' or (new.helper_daily_rate_status = 'confirmed' and new.helper_daily_rate is null)
    or new.other_expenses_status = 'unknown' or (new.other_expenses_status = 'confirmed' and new.other_expenses is null)
    or v_has_incomplete_dropoffs
  then
    new.financial_state := 'incomplete';
    new.financial_finalized_at := null;
    new.financial_finalized_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reconcile_delivery_financial_state on public.deliveries;
create trigger trg_reconcile_delivery_financial_state
  before insert or update on public.deliveries
  for each row
  execute function public.auto_reconcile_delivery_financial_state();

-- 5c. Atomic Delivery Creation RPC
create or replace function public.create_delivery_record(
  p_record jsonb,
  p_dropoffs jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_delivery_id uuid;
  v_existing_id uuid;
  v_client_id uuid;
  v_driver_id uuid;
  v_helper_id uuid;
  v_truck public.trucks%rowtype;
  v_stop jsonb;
  v_sequence integer := 0;
  v_entry_fees numeric(12,2);
  v_entry_status public.expense_resolution_status;
  v_request_id uuid := (p_record->>'idempotencyKey')::uuid;
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: delivery write permission is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_request_id::text, 0));
  select delivery_id into v_existing_id from public.delivery_mutation_requests
    where idempotency_key = v_request_id and actor_id = auth.uid();
  if found then return v_existing_id; end if;

  select id into v_client_id from public.clients
    where lower(name) = lower(trim(p_record->>'clientName')) and is_active = true limit 1;
  if v_client_id is null then raise exception 'INVALID_CLIENT: select an active client record'; end if;
  select * into v_truck from public.trucks
    where lower(plate_number) = lower(trim(p_record->>'plateNumber')) and is_active = true limit 1;
  if v_truck.id is null then raise exception 'INVALID_TRUCK: select an active Fleet record'; end if;
  if nullif(p_record->>'driverId', '') is not null then
    select id into v_driver_id from public.employees
      where id = (p_record->>'driverId')::uuid and assignment_type = 'Driver' and is_active = true;
  end if;
  if nullif(p_record->>'helperId', '') is not null then
    select id into v_helper_id from public.employees
      where id = (p_record->>'helperId')::uuid and assignment_type = 'Helper' and is_active = true;
  end if;

  insert into public.deliveries (
    waybill_number, delivery_date, client_id, truck_id, driver_id, helper_id,
    truck_type_snapshot, truck_temperature_snapshot, truck_ownership_snapshot, rate_basis,
    origin, distance_km, fuel_rate,
    diesel_expenses, diesel_expenses_status, toll_gate_expenses, toll_gate_expenses_status,
    toll_gate_breakdown, entry_fees, entry_fees_status, driver_allowance, driver_allowance_status,
    driver_daily_rate, driver_daily_rate_status, helper_allowance, helper_allowance_status,
    helper_daily_rate, helper_daily_rate_status, other_expenses, other_expenses_status,
    delivery_rate, pod_status, delivery_status, recording_delayed, notes, created_by
  ) values (
    trim(p_record->>'waybillNumber'), (p_record->>'deliveryDate')::date,
    v_client_id, v_truck.id, v_driver_id, v_helper_id,
    v_truck.truck_type, nullif(trim(p_record->>'truckTemperature'), ''),
    v_truck.ownership_type, v_truck.rate_basis,
    trim(p_record->>'origin'), (p_record->>'distanceKm')::numeric, (p_record->>'fuelRate')::numeric,
    nullif(p_record->>'dieselExpenses', '')::numeric, (p_record->>'dieselExpensesStatus')::public.expense_resolution_status,
    nullif(p_record->>'tollGateExpenses', '')::numeric, (p_record->>'tollGateExpensesStatus')::public.expense_resolution_status,
    nullif(trim(p_record->>'tollGateBreakdown'), ''),
    nullif(p_record->>'entryFees', '')::numeric, (p_record->>'entryFeesStatus')::public.expense_resolution_status,
    nullif(p_record->>'driverAllowance', '')::numeric, (p_record->>'driverAllowanceStatus')::public.expense_resolution_status,
    nullif(p_record->>'driverDailyRate', '')::numeric, (p_record->>'driverDailyRateStatus')::public.expense_resolution_status,
    nullif(p_record->>'helperAllowance', '')::numeric, (p_record->>'helperAllowanceStatus')::public.expense_resolution_status,
    nullif(p_record->>'helperDailyRate', '')::numeric, (p_record->>'helperDailyRateStatus')::public.expense_resolution_status,
    nullif(p_record->>'otherExpenses', '')::numeric, (p_record->>'otherExpensesStatus')::public.expense_resolution_status,
    (p_record->>'deliveryRate')::numeric,
    coalesce(nullif(p_record->>'podStatus', '')::public.pod_status, 'Pending'),
    coalesce(nullif(p_record->>'deliveryStatus', '')::public.delivery_status, 'Completed'),
    coalesce((p_record->>'recordingDelayed')::boolean, false),
    nullif(trim(p_record->>'notes'), ''), auth.uid()
  ) returning id into v_delivery_id;

  for v_stop in select * from jsonb_array_elements(p_dropoffs) loop
    v_sequence := v_sequence + 1;
    v_entry_fees := nullif(v_stop->>'entryFee', '')::numeric;
    v_entry_status := coalesce(nullif(v_stop->>'entryFeeStatus', '')::public.expense_resolution_status, 'confirmed');
    insert into public.delivery_dropoffs (
      delivery_id, sequence_number, store_name, destination_area, dropoff_count,
      entry_fee, entry_fee_status, pod_submitted, supporting_docs_complete, remarks,
      delivery_status, document_ref
    ) values (
      v_delivery_id, v_sequence, trim(v_stop->>'storeName'), trim(v_stop->>'destinationArea'),
      greatest(1, coalesce((v_stop->>'dropoffCount')::integer, 1)),
      v_entry_fees, v_entry_status,
      coalesce((v_stop->>'podSubmitted')::boolean, false),
      coalesce((v_stop->>'supportingDocsComplete')::boolean, false),
      nullif(trim(v_stop->>'remarks'), ''),
      coalesce(nullif(v_stop->>'deliveryStatus', '')::public.delivery_status, 'Completed'),
      coalesce(nullif(trim(v_stop->>'documentRef'), ''), 'Pending upload')
    );
  end loop;

  insert into public.delivery_mutation_requests (idempotency_key, mutation_type, delivery_id, actor_id, result)
  values (v_request_id, 'create_delivery', v_delivery_id, auth.uid(), jsonb_build_object('deliveryId', v_delivery_id));
  return v_delivery_id;
end;
$$;

-- 6. Row Level Security & Access Policies
alter table public.departments enable row level security;
alter table public.custom_roles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_department_memberships enable row level security;
alter table public.clients enable row level security;
alter table public.client_document_requirements enable row level security;
alter table public.trucks enable row level security;
alter table public.employees enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_dropoffs enable row level security;
alter table public.delivery_documents enable row level security;
alter table public.company_expenses enable row level security;
alter table public.delivery_activity enable row level security;
alter table public.delivery_mutation_requests enable row level security;

-- Open Select Policies: Active business reference data must always be visible
drop policy if exists "allow_select_departments" on public.departments;
create policy "allow_select_departments" on public.departments for select using (true);

drop policy if exists "allow_select_custom_roles" on public.custom_roles;
create policy "allow_select_custom_roles" on public.custom_roles for select using (true);

drop policy if exists "allow_select_user_profiles" on public.user_profiles;
create policy "allow_select_user_profiles" on public.user_profiles for select using (true);

drop policy if exists "allow_select_department_memberships" on public.user_department_memberships;
create policy "allow_select_department_memberships" on public.user_department_memberships for select using (true);

drop policy if exists "allow_select_clients" on public.clients;
create policy "allow_select_clients" on public.clients for select using (true);

drop policy if exists "allow_select_client_requirements" on public.client_document_requirements;
create policy "allow_select_client_requirements" on public.client_document_requirements for select using (true);

drop policy if exists "allow_select_trucks" on public.trucks;
create policy "allow_select_trucks" on public.trucks for select using (true);

drop policy if exists "allow_select_employees" on public.employees;
create policy "allow_select_employees" on public.employees for select using (true);

drop policy if exists "allow_select_deliveries" on public.deliveries;
create policy "allow_select_deliveries" on public.deliveries for select using (true);

drop policy if exists "allow_select_delivery_dropoffs" on public.delivery_dropoffs;
create policy "allow_select_delivery_dropoffs" on public.delivery_dropoffs for select using (true);

drop policy if exists "allow_select_delivery_documents" on public.delivery_documents;
create policy "allow_select_delivery_documents" on public.delivery_documents for select using (true);

drop policy if exists "allow_select_company_expenses" on public.company_expenses;
create policy "allow_select_company_expenses" on public.company_expenses for select using (true);

drop policy if exists "allow_select_delivery_activity" on public.delivery_activity;
create policy "allow_select_delivery_activity" on public.delivery_activity for select using (true);

-- Mutation Policies: Operations, Finance, and Service Role
drop policy if exists "allow_write_trucks" on public.trucks;
create policy "allow_write_trucks" on public.trucks for all
  using (public.can_write_operations()) with check (public.can_write_operations());

drop policy if exists "allow_write_clients" on public.clients;
create policy "allow_write_clients" on public.clients for all
  using (public.can_write_operations()) with check (public.can_write_operations());

drop policy if exists "allow_write_employees" on public.employees;
create policy "allow_write_employees" on public.employees for all
  using (public.can_write_operations()) with check (public.can_write_operations());

drop policy if exists "allow_write_deliveries" on public.deliveries;
create policy "allow_write_deliveries" on public.deliveries for all
  using (public.can_write_operations()) with check (public.can_write_operations());

drop policy if exists "allow_write_delivery_dropoffs" on public.delivery_dropoffs;
create policy "allow_write_delivery_dropoffs" on public.delivery_dropoffs for all
  using (public.can_write_operations()) with check (public.can_write_operations());

drop policy if exists "allow_write_delivery_documents" on public.delivery_documents;
create policy "allow_write_delivery_documents" on public.delivery_documents for all
  using (public.can_write_operations()) with check (public.can_write_operations());

drop policy if exists "allow_write_company_expenses" on public.company_expenses;
create policy "allow_write_company_expenses" on public.company_expenses for all
  using (public.can_write_finance()) with check (public.can_write_finance());

drop policy if exists "allow_write_user_profiles" on public.user_profiles;
drop policy if exists "allow_select_user_profiles" on public.user_profiles;

create policy "allow_select_user_profiles" on public.user_profiles
  for select using (true);

create policy "allow_insert_user_profiles" on public.user_profiles
  for insert with check (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (auth.uid() is not null and public.can_write_operations())
  );

create policy "allow_update_user_profiles" on public.user_profiles
  for update using (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or id = auth.uid()
    or (auth.uid() is not null and public.can_write_operations())
  );

create policy "allow_delete_user_profiles" on public.user_profiles
  for delete using (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (auth.uid() is not null and public.can_write_operations())
  );

-- 7. Grant Permissions
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role, postgres;
grant all on all sequences in schema public to service_role, postgres;
grant all on all routines in schema public to service_role, postgres;

grant select on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- 8. Core System Seed Data (Zero operational data: no trucks, no clients, no employees, no deliveries, no expenses)
insert into public.departments (id, name, description, default_permissions)
values
  ('admin', 'Administration', 'System administrators and executive leadership.', array['dashboard:view', 'deliveries:view', 'deliveries:create', 'deliveries:edit', 'deliveries:delete', 'dropoffs:manage', 'imports:upload', 'pod:view', 'pod:verify', 'pod:upload', 'profitability:view', 'profitability:manage', 'finance:view', 'finance:manage', 'reports:view', 'reports:export', 'reports:templates', 'users:view', 'users:manage', 'audit:view', 'system:settings']),
  ('operations', 'Operations', 'Daily logistics dispatch, fleet tracking, and delivery operations.', array['dashboard:view', 'deliveries:view', 'deliveries:create', 'deliveries:edit', 'dropoffs:manage', 'imports:upload', 'pod:view', 'pod:upload', 'profitability:view', 'profitability:manage', 'reports:view', 'reports:export']),
  ('finance', 'Finance & Accounting', 'Financial tracking, expense recording, billing, and trip profitability.', array['dashboard:view', 'deliveries:view', 'pod:view', 'profitability:view', 'finance:view', 'finance:manage', 'reports:view', 'reports:export']),
  ('hr', 'Human Resources', 'Personnel records, crew assignments, and staff coordination.', array['dashboard:view', 'deliveries:view', 'pod:view', 'reports:view']),
  ('secretary', 'Corporate Secretary', 'Documentation verification, compliance, and records archiving.', array['dashboard:view', 'deliveries:view', 'pod:view', 'pod:verify', 'reports:view', 'reports:export']),
  ('customerrep', 'Customer Support & Representative', 'Client shipment tracking, status verification, and customer delivery queries.', array['dashboard:view', 'deliveries:view', 'pod:view'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';

commit;
