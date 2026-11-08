-- RouteX feedback pass: preserve truck classification, delayed recording, and driver assignment.
begin;

alter table public.trucks
  add column if not exists storage_capability text not null default 'Refrigerated'
    check (storage_capability in ('Refrigerated', 'Dry')),
  add column if not exists ownership_type text not null default 'Owned'
    check (ownership_type in ('Owned', 'Subcontracted')),
  add column if not exists rate_basis text not null default 'Redeemed Rate'
    check (rate_basis in ('Redeemed Rate', 'Trucker Rate')),
  add column if not exists provider text,
  add column if not exists contact_person text;

alter table public.deliveries
  add column if not exists recording_delayed boolean not null default false,
  add column if not exists truck_ownership_snapshot text not null default 'Owned'
    check (truck_ownership_snapshot in ('Owned', 'Subcontracted')),
  add column if not exists rate_basis text not null default 'Redeemed Rate'
    check (rate_basis in ('Redeemed Rate', 'Trucker Rate'));

create unique index if not exists employees_active_driver_name_idx
  on public.employees (lower(full_name))
  where assignment_type = 'Driver' and is_active = true;

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
  v_existing_id uuid;
  v_client_id uuid;
  v_driver_id uuid;
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
  if v_driver_id is null then raise exception 'INVALID_DRIVER: select or add an active driver'; end if;
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
    waybill_number, delivery_date, recording_delayed, client_id, truck_id, driver_id,
    truck_type_snapshot, truck_temperature_snapshot, truck_ownership_snapshot, rate_basis,
    origin, distance_km, fuel_rate, diesel_expenses, diesel_expenses_status,
    toll_gate_expenses, toll_gate_expenses_status, toll_gate_breakdown, entry_fees,
    entry_fees_status, driver_allowance, driver_allowance_status, driver_daily_rate,
    driver_daily_rate_status, helper_allowance, helper_allowance_status,
    helper_daily_rate, helper_daily_rate_status, other_expenses, other_expenses_status,
    delivery_rate, pod_status, financial_state, created_by
  ) values (
    trim(p_record->>'waybillNumber'), (p_record->>'deliveryDate')::date,
    coalesce((p_record->>'recordingDelayed')::boolean, false), v_client_id, v_truck.id, v_driver_id,
    v_truck.truck_type, trim(p_record->>'truckTemperature'), v_truck.ownership_type, v_truck.rate_basis,
    trim(p_record->>'origin'), (p_record->>'distanceKm')::numeric, (p_record->>'fuelRate')::numeric,
    (p_record->>'dieselExpenses')::numeric, (p_record->>'dieselExpensesStatus')::public.expense_resolution_status,
    (p_record->>'tollGateExpenses')::numeric, (p_record->>'tollGateExpensesStatus')::public.expense_resolution_status,
    nullif(trim(p_record->>'tollGateBreakdown'), ''), v_entry_fees, v_entry_status,
    (p_record->>'driverAllowance')::numeric, (p_record->>'driverAllowanceStatus')::public.expense_resolution_status,
    (p_record->>'driverDailyRate')::numeric, (p_record->>'driverDailyRateStatus')::public.expense_resolution_status,
    (p_record->>'helperAllowance')::numeric, (p_record->>'helperAllowanceStatus')::public.expense_resolution_status,
    (p_record->>'helperDailyRate')::numeric, (p_record->>'helperDailyRateStatus')::public.expense_resolution_status,
    (p_record->>'otherExpenses')::numeric, (p_record->>'otherExpensesStatus')::public.expense_resolution_status,
    (p_record->>'deliveryRate')::numeric, 'Pending', 'incomplete', auth.uid()
  ) returning id into v_delivery_id;

  for v_stop in select value from jsonb_array_elements(p_dropoffs) loop
    v_sequence := v_sequence + 1;
    insert into public.delivery_dropoffs (
      delivery_id, sequence_number, store_name, destination_area, entry_fee,
      entry_fee_status, pod_submitted, supporting_docs_complete, document_ref
    ) values (
      v_delivery_id, v_sequence, trim(v_stop->>'storeName'), trim(v_stop->>'destinationArea'),
      (v_stop->>'entryFee')::numeric, (v_stop->>'entryFeeStatus')::public.expense_resolution_status,
      coalesce((v_stop->>'podSubmitted')::boolean, false),
      coalesce((v_stop->>'supportingDocsComplete')::boolean, false),
      nullif(trim(v_stop->>'documentRef'), '')
    );
  end loop;

  insert into public.delivery_activity (delivery_id, action, actor_id, changes, previous_version, resulting_version)
  values (v_delivery_id, 'Delivery Created', auth.uid(), jsonb_build_object(
    'waybillNumber', trim(p_record->>'waybillNumber'),
    'recordingDelayed', coalesce((p_record->>'recordingDelayed')::boolean, false),
    'financialState', 'incomplete'
  ), null, 1);
  insert into public.delivery_mutation_requests (idempotency_key, mutation_type, delivery_id, actor_id, result)
  values (v_request_id, 'create_delivery', v_delivery_id, auth.uid(),
    jsonb_build_object('deliveryId', v_delivery_id, 'version', 1));
  return v_delivery_id;
end;
$$;

grant execute on function public.create_delivery_record(jsonb, jsonb) to authenticated;

create or replace view public.delivery_ledger
with (security_invoker = true)
as
select d.*, c.name as client_name, c.is_active as client_is_active,
  t.plate_number, t.truck_type, t.storage_capability,
  t.is_active as truck_is_active, driver.full_name as driver_name,
  helper.full_name as helper_name
from public.deliveries d
join public.clients c on c.id = d.client_id
join public.trucks t on t.id = d.truck_id
left join public.employees driver on driver.id = d.driver_id
left join public.employees helper on helper.id = d.helper_id;

commit;
