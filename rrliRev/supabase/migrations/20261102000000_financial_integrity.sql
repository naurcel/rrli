-- RouteX financial integrity, optimistic concurrency, audited corrections,
-- and server-side reporting. Apply after the Stage 2 migration.
--
-- Historical amounts are deliberately left unresolved. Existing zeroes (and
-- non-zeroes) do not prove that an operator confirmed the expense, so every
-- pre-migration delivery remains financially incomplete until reviewed.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_resolution_status') then
    create type public.expense_resolution_status as enum (
      'confirmed', 'not_applicable', 'unknown'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_financial_state') then
    create type public.delivery_financial_state as enum ('incomplete', 'finalized');
  end if;
end
$$;

create or replace function public.resolved_expense_amount(
  p_amount numeric,
  p_status public.expense_resolution_status
)
returns numeric
language sql
immutable
as $$
  select case
    when p_status = 'unknown' then null
    when p_status = 'not_applicable' then 0::numeric
    when p_amount is not null and p_amount >= 0 then p_amount
    else null
  end;
$$;

create or replace function public.calculate_delivery_expenses(
  p_diesel numeric, p_diesel_status public.expense_resolution_status,
  p_toll numeric, p_toll_status public.expense_resolution_status,
  p_entry numeric, p_entry_status public.expense_resolution_status,
  p_driver_allowance numeric, p_driver_allowance_status public.expense_resolution_status,
  p_driver_rate numeric, p_driver_rate_status public.expense_resolution_status,
  p_helper_allowance numeric, p_helper_allowance_status public.expense_resolution_status,
  p_helper_rate numeric, p_helper_rate_status public.expense_resolution_status,
  p_other numeric, p_other_status public.expense_resolution_status
)
returns numeric
language sql
immutable
as $$
  select case when
    public.resolved_expense_amount(p_diesel, p_diesel_status) is null or
    public.resolved_expense_amount(p_toll, p_toll_status) is null or
    public.resolved_expense_amount(p_entry, p_entry_status) is null or
    public.resolved_expense_amount(p_driver_allowance, p_driver_allowance_status) is null or
    public.resolved_expense_amount(p_driver_rate, p_driver_rate_status) is null or
    public.resolved_expense_amount(p_helper_allowance, p_helper_allowance_status) is null or
    public.resolved_expense_amount(p_helper_rate, p_helper_rate_status) is null or
    public.resolved_expense_amount(p_other, p_other_status) is null
  then null else
    public.resolved_expense_amount(p_diesel, p_diesel_status) +
    public.resolved_expense_amount(p_toll, p_toll_status) +
    public.resolved_expense_amount(p_entry, p_entry_status) +
    public.resolved_expense_amount(p_driver_allowance, p_driver_allowance_status) +
    public.resolved_expense_amount(p_driver_rate, p_driver_rate_status) +
    public.resolved_expense_amount(p_helper_allowance, p_helper_allowance_status) +
    public.resolved_expense_amount(p_helper_rate, p_helper_rate_status) +
    public.resolved_expense_amount(p_other, p_other_status)
  end;
$$;

create or replace function public.calculate_profit_margin(
  p_revenue numeric,
  p_net_income numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_revenue is null or p_revenue = 0 or p_net_income is null then null
    else p_net_income / p_revenue * 100
  end;
$$;

-- Generated financial columns must be rebuilt after the resolution columns exist.
alter table public.deliveries
  drop column if exists profit_margin,
  drop column if exists net_income,
  drop column if exists total_expenses;

alter table public.deliveries
  alter column diesel_expenses drop not null,
  alter column toll_gate_expenses drop not null,
  alter column entry_fees drop not null,
  alter column driver_allowance drop not null,
  alter column driver_daily_rate drop not null,
  alter column helper_allowance drop not null,
  alter column helper_daily_rate drop not null,
  alter column other_expenses drop not null,
  add column if not exists diesel_expenses_status public.expense_resolution_status not null default 'unknown',
  add column if not exists toll_gate_expenses_status public.expense_resolution_status not null default 'unknown',
  add column if not exists entry_fees_status public.expense_resolution_status not null default 'unknown',
  add column if not exists driver_allowance_status public.expense_resolution_status not null default 'unknown',
  add column if not exists driver_daily_rate_status public.expense_resolution_status not null default 'unknown',
  add column if not exists helper_allowance_status public.expense_resolution_status not null default 'unknown',
  add column if not exists helper_daily_rate_status public.expense_resolution_status not null default 'unknown',
  add column if not exists other_expenses_status public.expense_resolution_status not null default 'unknown',
  add column if not exists financial_state public.delivery_financial_state not null default 'incomplete',
  add column if not exists financial_finalized_at timestamptz,
  add column if not exists financial_finalized_by uuid references auth.users(id) on delete set null;

alter table public.delivery_dropoffs
  alter column entry_fee drop not null,
  add column if not exists entry_fee_status public.expense_resolution_status not null default 'unknown';

alter table public.deliveries
  add column total_expenses numeric(12, 2) generated always as (
    public.calculate_delivery_expenses(
      diesel_expenses, diesel_expenses_status,
      toll_gate_expenses, toll_gate_expenses_status,
      entry_fees, entry_fees_status,
      driver_allowance, driver_allowance_status,
      driver_daily_rate, driver_daily_rate_status,
      helper_allowance, helper_allowance_status,
      helper_daily_rate, helper_daily_rate_status,
      other_expenses, other_expenses_status
    )
  ) stored,
  add column net_income numeric(12, 2) generated always as (
    case when public.calculate_delivery_expenses(
      diesel_expenses, diesel_expenses_status,
      toll_gate_expenses, toll_gate_expenses_status,
      entry_fees, entry_fees_status,
      driver_allowance, driver_allowance_status,
      driver_daily_rate, driver_daily_rate_status,
      helper_allowance, helper_allowance_status,
      helper_daily_rate, helper_daily_rate_status,
      other_expenses, other_expenses_status
    ) is null then null else delivery_rate - public.calculate_delivery_expenses(
      diesel_expenses, diesel_expenses_status,
      toll_gate_expenses, toll_gate_expenses_status,
      entry_fees, entry_fees_status,
      driver_allowance, driver_allowance_status,
      driver_daily_rate, driver_daily_rate_status,
      helper_allowance, helper_allowance_status,
      helper_daily_rate, helper_daily_rate_status,
      other_expenses, other_expenses_status
    ) end
  ) stored,
  add column profit_margin numeric(9, 4) generated always as (
    public.calculate_profit_margin(
      delivery_rate,
      delivery_rate - public.calculate_delivery_expenses(
        diesel_expenses, diesel_expenses_status,
        toll_gate_expenses, toll_gate_expenses_status,
        entry_fees, entry_fees_status,
        driver_allowance, driver_allowance_status,
        driver_daily_rate, driver_daily_rate_status,
        helper_allowance, helper_allowance_status,
        helper_daily_rate, helper_daily_rate_status,
        other_expenses, other_expenses_status
      )
    )
  ) stored;

alter table public.deliveries drop constraint if exists deliveries_financial_state_check;
alter table public.deliveries add constraint deliveries_financial_state_check check (
  financial_state = 'incomplete' or (
    total_expenses is not null and
    financial_finalized_at is not null and
    financial_finalized_by is not null
  )
);

create index if not exists deliveries_financial_state_date_idx
  on public.deliveries (financial_state, delivery_date desc);
create index if not exists deliveries_net_income_idx
  on public.deliveries (net_income desc nulls last);
create index if not exists deliveries_profit_margin_idx
  on public.deliveries (profit_margin desc nulls last);

create table if not exists public.delivery_mutation_requests (
  idempotency_key uuid primary key,
  mutation_type text not null,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.delivery_mutation_requests enable row level security;
drop policy if exists "Actors can read own mutation requests" on public.delivery_mutation_requests;
create policy "Actors can read own mutation requests"
  on public.delivery_mutation_requests for select to authenticated
  using (actor_id = auth.uid());
drop policy if exists "Actors can create own mutation requests" on public.delivery_mutation_requests;
create policy "Actors can create own mutation requests"
  on public.delivery_mutation_requests for insert to authenticated
  with check (actor_id = auth.uid());

alter table public.delivery_activity
  add column if not exists reason text,
  add column if not exists previous_version integer,
  add column if not exists resulting_version integer;

create or replace function public.create_delivery_record(p_record jsonb, p_dropoffs jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_existing_id uuid;
  v_client_id uuid;
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
  if jsonb_typeof(p_dropoffs) <> 'array' or jsonb_array_length(p_dropoffs) = 0 then
    raise exception 'INVALID_DROPOFFS: at least one store drop-off is required';
  end if;

  select case
    when bool_or(coalesce(value->>'entryFeeStatus', 'unknown') = 'unknown') then 'unknown'::public.expense_resolution_status
    when bool_and(coalesce(value->>'entryFeeStatus', 'unknown') = 'not_applicable') then 'not_applicable'::public.expense_resolution_status
    else 'confirmed'::public.expense_resolution_status end,
    case when bool_or(coalesce(value->>'entryFeeStatus', 'unknown') = 'unknown') then null
      else coalesce(sum(case when value->>'entryFeeStatus' = 'confirmed'
        then (value->>'entryFee')::numeric else 0 end), 0) end
  into v_entry_status, v_entry_fees from jsonb_array_elements(p_dropoffs);

  insert into public.deliveries (
    waybill_number, delivery_date, client_id, truck_id, truck_type_snapshot,
    truck_temperature_snapshot, origin, distance_km, fuel_rate,
    diesel_expenses, diesel_expenses_status, toll_gate_expenses, toll_gate_expenses_status,
    toll_gate_breakdown, entry_fees, entry_fees_status,
    driver_allowance, driver_allowance_status, driver_daily_rate, driver_daily_rate_status,
    helper_allowance, helper_allowance_status, helper_daily_rate, helper_daily_rate_status,
    other_expenses, other_expenses_status, delivery_rate, pod_status, financial_state, created_by
  ) values (
    trim(p_record->>'waybillNumber'), (p_record->>'deliveryDate')::date,
    v_client_id, v_truck.id, v_truck.truck_type, trim(p_record->>'truckTemperature'),
    trim(p_record->>'origin'), (p_record->>'distanceKm')::numeric,
    (p_record->>'fuelRate')::numeric,
    (p_record->>'dieselExpenses')::numeric,
    (p_record->>'dieselExpensesStatus')::public.expense_resolution_status,
    (p_record->>'tollGateExpenses')::numeric,
    (p_record->>'tollGateExpensesStatus')::public.expense_resolution_status,
    nullif(trim(p_record->>'tollGateBreakdown'), ''), v_entry_fees, v_entry_status,
    (p_record->>'driverAllowance')::numeric,
    (p_record->>'driverAllowanceStatus')::public.expense_resolution_status,
    (p_record->>'driverDailyRate')::numeric,
    (p_record->>'driverDailyRateStatus')::public.expense_resolution_status,
    (p_record->>'helperAllowance')::numeric,
    (p_record->>'helperAllowanceStatus')::public.expense_resolution_status,
    (p_record->>'helperDailyRate')::numeric,
    (p_record->>'helperDailyRateStatus')::public.expense_resolution_status,
    (p_record->>'otherExpenses')::numeric,
    (p_record->>'otherExpensesStatus')::public.expense_resolution_status,
    (p_record->>'deliveryRate')::numeric, 'Pending', 'incomplete', auth.uid()
  ) returning id into v_delivery_id;

  for v_stop in select value from jsonb_array_elements(p_dropoffs) loop
    v_sequence := v_sequence + 1;
    insert into public.delivery_dropoffs (
      delivery_id, sequence_number, store_name, destination_area, entry_fee,
      entry_fee_status, pod_submitted, supporting_docs_complete, document_ref
    ) values (
      v_delivery_id, v_sequence, trim(v_stop->>'storeName'), trim(v_stop->>'destinationArea'),
      (v_stop->>'entryFee')::numeric,
      (v_stop->>'entryFeeStatus')::public.expense_resolution_status,
      false, false, nullif(trim(v_stop->>'documentRef'), '')
    );
  end loop;

  insert into public.delivery_activity
    (delivery_id, action, actor_id, changes, previous_version, resulting_version)
  values (v_delivery_id, 'Delivery Created', auth.uid(), jsonb_build_object(
    'waybillNumber', trim(p_record->>'waybillNumber'), 'financialState', 'incomplete'
  ), null, 1);
  insert into public.delivery_mutation_requests
    (idempotency_key, mutation_type, delivery_id, actor_id, result)
  values (v_request_id, 'create_delivery', v_delivery_id, auth.uid(),
    jsonb_build_object('deliveryId', v_delivery_id, 'version', 1));
  return v_delivery_id;
end;
$$;
grant execute on function public.create_delivery_record(jsonb, jsonb) to authenticated;

create or replace function public.finalize_delivery_financials(
  p_delivery_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_existing jsonb;
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: financial finalization permission is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select result into v_existing from public.delivery_mutation_requests
    where idempotency_key = p_idempotency_key and actor_id = auth.uid();
  if found then return v_existing; end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id;
  if not found then raise exception 'NOT_FOUND: delivery was not found'; end if;
  if v_delivery.version <> p_expected_version then
    raise exception 'VERSION_CONFLICT: expected %, current %', p_expected_version, v_delivery.version;
  end if;
  if v_delivery.total_expenses is null or v_delivery.net_income is null then
    raise exception 'FINANCIALS_INCOMPLETE: resolve every unknown expense before finalization';
  end if;

  update public.deliveries
  set financial_state = 'finalized', financial_finalized_at = now(),
      financial_finalized_by = auth.uid(), version = version + 1, updated_at = now()
  where id = p_delivery_id and version = p_expected_version;
  if not found then raise exception 'VERSION_CONFLICT: delivery changed during finalization'; end if;

  insert into public.delivery_activity
    (delivery_id, action, actor_id, changes, previous_version, resulting_version)
  values (p_delivery_id, 'Financials Finalized', auth.uid(), jsonb_build_object(
    'totalExpenses', v_delivery.total_expenses,
    'netIncome', v_delivery.net_income,
    'profitMargin', v_delivery.profit_margin
  ), p_expected_version, p_expected_version + 1);

  v_existing := jsonb_build_object(
    'deliveryId', p_delivery_id, 'financialState', 'finalized',
    'version', p_expected_version + 1
  );
  insert into public.delivery_mutation_requests
    (idempotency_key, mutation_type, delivery_id, actor_id, result)
  values (p_idempotency_key, 'finalize_financials', p_delivery_id, auth.uid(), v_existing);
  return v_existing;
end;
$$;
grant execute on function public.finalize_delivery_financials(uuid, integer, uuid) to authenticated;

create or replace function public.correct_delivery_financials(
  p_delivery_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before public.deliveries%rowtype;
  v_after public.deliveries%rowtype;
  v_existing jsonb;
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: financial correction permission is required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'REASON_REQUIRED: provide a meaningful correction reason';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select result into v_existing from public.delivery_mutation_requests
    where idempotency_key = p_idempotency_key and actor_id = auth.uid();
  if found then return v_existing; end if;
  select * into v_before from public.deliveries where id = p_delivery_id;
  if not found then raise exception 'NOT_FOUND: delivery was not found'; end if;
  if v_before.version <> p_expected_version then
    raise exception 'VERSION_CONFLICT: expected %, current %', p_expected_version, v_before.version;
  end if;

  update public.deliveries set
    delivery_rate = coalesce((p_changes->>'deliveryRate')::numeric, delivery_rate),
    diesel_expenses = case when p_changes ? 'dieselExpenses' then (p_changes->>'dieselExpenses')::numeric else diesel_expenses end,
    diesel_expenses_status = coalesce((p_changes->>'dieselExpensesStatus')::public.expense_resolution_status, diesel_expenses_status),
    toll_gate_expenses = case when p_changes ? 'tollGateExpenses' then (p_changes->>'tollGateExpenses')::numeric else toll_gate_expenses end,
    toll_gate_expenses_status = coalesce((p_changes->>'tollGateExpensesStatus')::public.expense_resolution_status, toll_gate_expenses_status),
    driver_allowance = case when p_changes ? 'driverAllowance' then (p_changes->>'driverAllowance')::numeric else driver_allowance end,
    driver_allowance_status = coalesce((p_changes->>'driverAllowanceStatus')::public.expense_resolution_status, driver_allowance_status),
    driver_daily_rate = case when p_changes ? 'driverDailyRate' then (p_changes->>'driverDailyRate')::numeric else driver_daily_rate end,
    driver_daily_rate_status = coalesce((p_changes->>'driverDailyRateStatus')::public.expense_resolution_status, driver_daily_rate_status),
    helper_allowance = case when p_changes ? 'helperAllowance' then (p_changes->>'helperAllowance')::numeric else helper_allowance end,
    helper_allowance_status = coalesce((p_changes->>'helperAllowanceStatus')::public.expense_resolution_status, helper_allowance_status),
    helper_daily_rate = case when p_changes ? 'helperDailyRate' then (p_changes->>'helperDailyRate')::numeric else helper_daily_rate end,
    helper_daily_rate_status = coalesce((p_changes->>'helperDailyRateStatus')::public.expense_resolution_status, helper_daily_rate_status),
    other_expenses = case when p_changes ? 'otherExpenses' then (p_changes->>'otherExpenses')::numeric else other_expenses end,
    other_expenses_status = coalesce((p_changes->>'otherExpensesStatus')::public.expense_resolution_status, other_expenses_status),
    financial_state = 'incomplete', financial_finalized_at = null, financial_finalized_by = null,
    version = version + 1, updated_at = now()
  where id = p_delivery_id and version = p_expected_version
  returning * into v_after;
  if not found then raise exception 'VERSION_CONFLICT: delivery changed during correction'; end if;

  insert into public.delivery_activity
    (delivery_id, action, actor_id, changes, reason, previous_version, resulting_version)
  values (p_delivery_id, 'Financial Correction', auth.uid(), jsonb_build_object(
    'previous', to_jsonb(v_before), 'updated', to_jsonb(v_after), 'requestedChanges', p_changes
  ), trim(p_reason), p_expected_version, p_expected_version + 1);

  v_existing := jsonb_build_object(
    'deliveryId', p_delivery_id, 'financialState', 'incomplete',
    'version', p_expected_version + 1
  );
  insert into public.delivery_mutation_requests
    (idempotency_key, mutation_type, delivery_id, actor_id, result)
  values (p_idempotency_key, 'correct_financials', p_delivery_id, auth.uid(), v_existing);
  return v_existing;
end;
$$;
grant execute on function public.correct_delivery_financials(uuid, integer, jsonb, text, uuid) to authenticated;

drop function if exists public.update_dropoff_document_state(uuid, uuid, boolean, boolean, text);
create function public.update_dropoff_document_state(
  p_delivery_id uuid,
  p_dropoff_id uuid,
  p_expected_version integer,
  p_pod_submitted boolean,
  p_supporting_docs_complete boolean,
  p_document_ref text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_current_version integer;
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: POD verification permission is required';
  end if;
  select version into v_current_version from public.deliveries where id = p_delivery_id;
  if not found then raise exception 'NOT_FOUND: delivery was not found'; end if;
  if v_current_version <> p_expected_version then
    raise exception 'VERSION_CONFLICT: expected %, current %', p_expected_version, v_current_version;
  end if;

  update public.delivery_dropoffs set
    pod_submitted = p_pod_submitted,
    supporting_docs_complete = p_supporting_docs_complete,
    document_ref = coalesce(nullif(trim(p_document_ref), ''), document_ref)
  where id = p_dropoff_id and delivery_id = p_delivery_id;
  if not found then raise exception 'NOT_FOUND: delivery drop-off was not found'; end if;

  select case when count(*) = 0 then 'Pending'
    when bool_and(pod_submitted and supporting_docs_complete) then 'Verified'
    when bool_or(pod_submitted or supporting_docs_complete) then 'Incomplete'
    else 'Pending' end into v_status
  from public.delivery_dropoffs where delivery_id = p_delivery_id;

  update public.deliveries set pod_status = v_status, version = version + 1, updated_at = now()
  where id = p_delivery_id and version = p_expected_version;
  if not found then raise exception 'VERSION_CONFLICT: delivery changed during POD update'; end if;

  insert into public.delivery_activity
    (delivery_id, action, actor_id, changes, previous_version, resulting_version)
  values (p_delivery_id, 'POD State Updated', auth.uid(), jsonb_build_object(
    'dropoffId', p_dropoff_id, 'podSubmitted', p_pod_submitted,
    'supportingDocsComplete', p_supporting_docs_complete, 'deliveryPodStatus', v_status
  ), p_expected_version, p_expected_version + 1);
  return jsonb_build_object('podStatus', v_status, 'version', p_expected_version + 1);
end;
$$;
grant execute on function public.update_dropoff_document_state(uuid, uuid, integer, boolean, boolean, text) to authenticated;

create or replace function public.delivery_profitability_summary(
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with eligible as (
    select * from public.deliveries
    where financial_state = 'finalized'
      and (p_date_from is null or delivery_date >= p_date_from)
      and (p_date_to is null or delivery_date <= p_date_to)
  ), totals as (
    select count(*)::integer as deliveries,
      coalesce(sum(delivery_rate), 0) as revenue,
      coalesce(sum(total_expenses), 0) as expenses,
      coalesce(sum(net_income), 0) as net_income
    from eligible
  ), trucks as (
    select t.id as truck_id, t.plate_number, count(*)::integer as deliveries,
      sum(e.delivery_rate) as revenue, sum(e.total_expenses) as expenses,
      sum(e.net_income) as net_income,
      case when sum(e.delivery_rate) = 0 then null
           else sum(e.net_income) / sum(e.delivery_rate) * 100 end as profit_margin
    from eligible e join public.trucks t on t.id = e.truck_id
    group by t.id, t.plate_number
  )
  select jsonb_build_object(
    'deliveries', totals.deliveries,
    'revenue', totals.revenue,
    'expenses', totals.expenses,
    'netIncome', totals.net_income,
    'profitMargin', case when totals.revenue = 0 then null
      else totals.net_income / totals.revenue * 100 end,
    'trucks', coalesce((select jsonb_agg(to_jsonb(trucks) order by revenue desc) from trucks), '[]'::jsonb)
  ) from totals;
$$;
grant execute on function public.delivery_profitability_summary(date, date) to authenticated;

create or replace view public.delivery_ledger
with (security_invoker = true)
as
select d.*, c.name as client_name, c.is_active as client_is_active,
  t.plate_number, t.truck_type, t.truck_temperature, t.is_active as truck_is_active,
  driver.full_name as driver_name, helper.full_name as helper_name
from public.deliveries d
join public.clients c on c.id = d.client_id
join public.trucks t on t.id = d.truck_id
left join public.employees driver on driver.id = d.driver_id
left join public.employees helper on helper.id = d.helper_id;

commit;
