-- RouteX Stage 2: delivery-management relationships, query support, documents,
-- import review rows, and audit history. Apply after the revised foundation.

begin;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique,
  full_name text not null,
  assignment_type text not null check (assignment_type in ('Driver', 'Helper', 'Other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees enable row level security;
drop policy if exists "Authenticated active staff can view employees" on public.employees;
create policy "Authenticated active staff can view employees"
  on public.employees for select to authenticated
  using (public.can_read_operations());
drop policy if exists "Admin and Operations can manage employees" on public.employees;
create policy "Admin and Operations can manage employees"
  on public.employees for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

alter table public.deliveries
  add column if not exists driver_id uuid references public.employees(id) on delete restrict,
  add column if not exists helper_id uuid references public.employees(id) on delete restrict,
  add column if not exists delivery_status text not null default 'Completed',
  add column if not exists version integer not null default 1,
  add column if not exists profit_margin numeric(9, 4) generated always as (
    case
      when delivery_rate = 0 then null
      else (
        delivery_rate - (
          diesel_expenses + toll_gate_expenses + entry_fees + driver_allowance +
          driver_daily_rate + helper_allowance + helper_daily_rate + other_expenses
        )
      ) / delivery_rate * 100
    end
  ) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deliveries_delivery_status_check'
  ) then
    alter table public.deliveries
      add constraint deliveries_delivery_status_check
      check (delivery_status in ('Completed'));
  end if;
end
$$;

alter table public.delivery_dropoffs
  add column if not exists delivery_status text,
  add column if not exists document_ref text;

comment on column public.deliveries.delivery_status is
  'Stage 2 records completed trips. Additional lifecycle values require an approved business decision.';

create index if not exists deliveries_delivery_date_idx
  on public.deliveries (delivery_date desc, id);
create index if not exists deliveries_client_date_idx
  on public.deliveries (client_id, delivery_date desc);
create index if not exists deliveries_truck_date_idx
  on public.deliveries (truck_id, delivery_date desc);
create index if not exists deliveries_pod_status_idx
  on public.deliveries (pod_status, delivery_date desc);
create index if not exists deliveries_delivery_status_idx
  on public.deliveries (delivery_status, delivery_date desc);
create index if not exists deliveries_delivery_rate_idx
  on public.deliveries (delivery_rate desc);
create index if not exists deliveries_net_income_idx
  on public.deliveries (net_income desc);
create index if not exists deliveries_profit_margin_idx
  on public.deliveries (profit_margin desc nulls last);
create index if not exists deliveries_waybill_search_idx
  on public.deliveries (lower(waybill_number) text_pattern_ops);

create or replace view public.delivery_ledger
with (security_invoker = true)
as
select
  d.*,
  c.name as client_name,
  c.is_active as client_is_active,
  t.plate_number,
  t.truck_type,
  t.truck_temperature,
  t.is_active as truck_is_active,
  driver.full_name as driver_name,
  helper.full_name as helper_name
from public.deliveries d
join public.clients c on c.id = d.client_id
join public.trucks t on t.id = d.truck_id
left join public.employees driver on driver.id = d.driver_id
left join public.employees helper on helper.id = d.helper_id;

grant select on public.delivery_ledger to authenticated;

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

alter table public.client_document_requirements enable row level security;
drop policy if exists "Authenticated active staff can view document requirements" on public.client_document_requirements;
create policy "Authenticated active staff can view document requirements"
  on public.client_document_requirements for select to authenticated
  using (public.can_read_operations());
drop policy if exists "Admin and Operations can manage document requirements" on public.client_document_requirements;
create policy "Admin and Operations can manage document requirements"
  on public.client_document_requirements for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

create table if not exists public.delivery_documents (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  dropoff_id uuid references public.delivery_dropoffs(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  status text not null default 'Missing'
    check (status in ('Missing', 'Submitted', 'Verified', 'Rejected')),
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  verification_notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_id, dropoff_id, requirement_key)
);

alter table public.delivery_documents enable row level security;
drop policy if exists "Authenticated active staff can view delivery documents" on public.delivery_documents;
create policy "Authenticated active staff can view delivery documents"
  on public.delivery_documents for select to authenticated
  using (public.can_read_operations());
drop policy if exists "Admin and Operations can manage delivery documents" on public.delivery_documents;
create policy "Admin and Operations can manage delivery documents"
  on public.delivery_documents for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

create index if not exists delivery_documents_delivery_status_idx
  on public.delivery_documents (delivery_id, status);

create table if not exists public.delivery_activity (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  changes jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.delivery_activity enable row level security;
drop policy if exists "Authenticated active staff can view delivery activity" on public.delivery_activity;
create policy "Authenticated active staff can view delivery activity"
  on public.delivery_activity for select to authenticated
  using (public.can_read_operations());
drop policy if exists "Authorized staff can append delivery activity" on public.delivery_activity;
create policy "Authorized staff can append delivery activity"
  on public.delivery_activity for insert to authenticated
  with check (public.can_write_operations());

create index if not exists delivery_activity_delivery_time_idx
  on public.delivery_activity (delivery_id, occurred_at desc);

create table if not exists public.excel_import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.excel_import_batches(id) on delete cascade,
  row_number integer not null check (row_number >= 1),
  raw_values jsonb not null,
  normalized_values jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  review_status text not null default 'Needs Review'
    check (review_status in ('Needs Review', 'Valid', 'Invalid', 'Excluded')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

alter table public.excel_import_rows enable row level security;
drop policy if exists "Authenticated active staff can view staged import rows" on public.excel_import_rows;
create policy "Authenticated active staff can view staged import rows"
  on public.excel_import_rows for select to authenticated
  using (public.can_read_operations());
drop policy if exists "Admin and Operations can manage staged import rows" on public.excel_import_rows;
create policy "Admin and Operations can manage staged import rows"
  on public.excel_import_rows for all to authenticated
  using (public.can_write_operations())
  with check (public.can_write_operations());

create index if not exists excel_import_rows_batch_status_idx
  on public.excel_import_rows (batch_id, review_status, row_number);

create or replace function public.create_delivery_record(
  p_record jsonb,
  p_dropoffs jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_client_id uuid;
  v_truck public.trucks%rowtype;
  v_stop jsonb;
  v_sequence integer := 0;
  v_entry_fees numeric(12, 2) := 0;
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: delivery write permission is required';
  end if;

  select id into v_client_id
  from public.clients
  where lower(name) = lower(trim(p_record->>'clientName'))
    and is_active = true
  limit 1;

  if v_client_id is null then
    raise exception 'INVALID_CLIENT: select an active client record';
  end if;

  select * into v_truck
  from public.trucks
  where lower(plate_number) = lower(trim(p_record->>'plateNumber'))
    and is_active = true
  limit 1;

  if v_truck.id is null then
    raise exception 'INVALID_TRUCK: select an active Fleet record';
  end if;

  if jsonb_typeof(p_dropoffs) <> 'array' or jsonb_array_length(p_dropoffs) = 0 then
    raise exception 'INVALID_DROPOFFS: at least one store drop-off is required';
  end if;

  select coalesce(sum((value->>'entryFee')::numeric), 0)
  into v_entry_fees
  from jsonb_array_elements(p_dropoffs);

  insert into public.deliveries (
    waybill_number, delivery_date, client_id, truck_id,
    truck_type_snapshot, truck_temperature_snapshot, origin, distance_km,
    fuel_rate, diesel_expenses, toll_gate_expenses, toll_gate_breakdown,
    entry_fees, driver_allowance, driver_daily_rate, helper_allowance,
    helper_daily_rate, other_expenses, delivery_rate, pod_status, created_by
  ) values (
    trim(p_record->>'waybillNumber'),
    (p_record->>'deliveryDate')::date,
    v_client_id,
    v_truck.id,
    v_truck.truck_type,
    v_truck.truck_temperature,
    trim(p_record->>'origin'),
    (p_record->>'distanceKm')::numeric,
    (p_record->>'fuelRate')::numeric,
    (p_record->>'dieselExpenses')::numeric,
    (p_record->>'tollGateExpenses')::numeric,
    nullif(trim(p_record->>'tollGateBreakdown'), ''),
    v_entry_fees,
    (p_record->>'driverAllowance')::numeric,
    (p_record->>'driverDailyRate')::numeric,
    (p_record->>'helperAllowance')::numeric,
    (p_record->>'helperDailyRate')::numeric,
    (p_record->>'otherExpenses')::numeric,
    (p_record->>'deliveryRate')::numeric,
    'Pending',
    auth.uid()
  ) returning id into v_delivery_id;

  for v_stop in select value from jsonb_array_elements(p_dropoffs)
  loop
    v_sequence := v_sequence + 1;
    insert into public.delivery_dropoffs (
      delivery_id, sequence_number, store_name, destination_area, entry_fee,
      pod_submitted, supporting_docs_complete, document_ref
    ) values (
      v_delivery_id,
      v_sequence,
      trim(v_stop->>'storeName'),
      trim(v_stop->>'destinationArea'),
      (v_stop->>'entryFee')::numeric,
      coalesce((v_stop->>'podSubmitted')::boolean, false),
      coalesce((v_stop->>'supportingDocsComplete')::boolean, false),
      nullif(trim(v_stop->>'documentRef'), '')
    );
  end loop;

  insert into public.delivery_activity (delivery_id, action, actor_id, changes)
  values (
    v_delivery_id,
    'Delivery Created',
    auth.uid(),
    jsonb_build_object('waybillNumber', trim(p_record->>'waybillNumber'))
  );

  return v_delivery_id;
end;
$$;

grant execute on function public.create_delivery_record(jsonb, jsonb) to authenticated;

create or replace function public.update_dropoff_document_state(
  p_delivery_id uuid,
  p_dropoff_id uuid,
  p_pod_submitted boolean,
  p_supporting_docs_complete boolean,
  p_document_ref text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: POD verification permission is required';
  end if;

  update public.delivery_dropoffs
  set pod_submitted = p_pod_submitted,
      supporting_docs_complete = p_supporting_docs_complete,
      document_ref = coalesce(nullif(trim(p_document_ref), ''), document_ref)
  where id = p_dropoff_id and delivery_id = p_delivery_id;

  if not found then
    raise exception 'NOT_FOUND: delivery drop-off was not found';
  end if;

  select case
    when count(*) = 0 then 'Pending'
    when bool_and(pod_submitted and supporting_docs_complete) then 'Verified'
    when bool_or(pod_submitted or supporting_docs_complete) then 'Incomplete'
    else 'Pending'
  end into v_status
  from public.delivery_dropoffs
  where delivery_id = p_delivery_id;

  update public.deliveries
  set pod_status = v_status,
      version = version + 1,
      updated_at = now()
  where id = p_delivery_id;

  insert into public.delivery_activity (delivery_id, action, actor_id, changes)
  values (
    p_delivery_id,
    'POD State Updated',
    auth.uid(),
    jsonb_build_object(
      'dropoffId', p_dropoff_id,
      'podSubmitted', p_pod_submitted,
      'supportingDocsComplete', p_supporting_docs_complete,
      'deliveryPodStatus', v_status
    )
  );

  return v_status;
end;
$$;

grant execute on function public.update_dropoff_document_state(uuid, uuid, boolean, boolean, text) to authenticated;

-- The bucket remains private. Application requests must use an authenticated
-- Supabase client and short-lived signed URLs for downloads.
insert into storage.buckets (id, name, public)
values ('delivery-documents', 'delivery-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated staff can read delivery document objects" on storage.objects;
create policy "Authenticated staff can read delivery document objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'delivery-documents' and public.can_read_operations());

drop policy if exists "Operations can upload delivery document objects" on storage.objects;
create policy "Operations can upload delivery document objects"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-documents' and public.can_write_operations());

drop policy if exists "Operations can update delivery document objects" on storage.objects;
create policy "Operations can update delivery document objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'delivery-documents' and public.can_write_operations())
  with check (bucket_id = 'delivery-documents' and public.can_write_operations());

drop policy if exists "Operations can remove delivery document objects" on storage.objects;
create policy "Operations can remove delivery document objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'delivery-documents' and public.can_write_operations());

commit;
