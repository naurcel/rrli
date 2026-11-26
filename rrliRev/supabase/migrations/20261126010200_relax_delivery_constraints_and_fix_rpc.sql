-- Migration: 20261126010200_relax_delivery_constraints_and_fix_rpc.sql
-- Relaxes deliveries table constraints and fixes create_delivery_record RPC
-- Operational Rule:
-- Owned trucks require waybill + truck.
-- Subcons require only truck.
-- Other fields (client, driver, helper, origin, rate, dropoffs, expenses) can be delayed.

-- 1. Relax table column constraints
alter table public.deliveries alter column client_id drop not null;
alter table public.deliveries alter column origin drop not null;
alter table public.deliveries alter column origin set default 'Pending Origin';
alter table public.deliveries alter column waybill_number drop not null;

alter table public.deliveries drop constraint if exists deliveries_delivery_rate_check;
alter table public.deliveries add constraint deliveries_delivery_rate_check check (delivery_rate >= 0);
alter table public.deliveries alter column delivery_rate set default 0;

-- Ensure default values for statuses and amounts
alter table public.deliveries alter column entry_fees_status set default 'confirmed';
alter table public.deliveries alter column diesel_expenses_status set default 'confirmed';
alter table public.deliveries alter column toll_gate_expenses_status set default 'confirmed';
alter table public.deliveries alter column driver_allowance_status set default 'confirmed';
alter table public.deliveries alter column driver_daily_rate_status set default 'confirmed';
alter table public.deliveries alter column helper_allowance_status set default 'confirmed';
alter table public.deliveries alter column helper_daily_rate_status set default 'confirmed';
alter table public.deliveries alter column other_expenses_status set default 'confirmed';

-- 2. Update auto-reconciliation trigger
create or replace function public.auto_reconcile_delivery_financial_state()
returns trigger language plpgsql as $$
declare
  v_has_incomplete_dropoffs boolean := false;
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
    or coalesce(new.delivery_rate, 0) = 0
    or new.client_id is null
    or v_has_incomplete_dropoffs
  then
    new.financial_state := 'incomplete';
    new.financial_finalized_at := null;
    new.financial_finalized_by := null;
  end if;

  return new;
end;
$$;

-- 3. Replace create_delivery_record with resilient error-free version
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
  v_entry_fees numeric(12,2) := 0;
  v_entry_status public.expense_resolution_status := 'confirmed';
  v_request_id uuid := (p_record->>'idempotencyKey')::uuid;
  v_waybill text;
  v_has_unknown_entry boolean := false;
  v_sum_entry numeric(12,2) := 0;
  v_dropoff_fee numeric(12,2);
  v_dropoff_status public.expense_resolution_status;
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: delivery write permission is required';
  end if;
  if v_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_request_id::text, 0));
    select delivery_id into v_existing_id from public.delivery_mutation_requests
      where idempotency_key = v_request_id and actor_id = auth.uid();
    if found then return v_existing_id; end if;
  end if;

  -- Truck is strictly required
  select * into v_truck from public.trucks
    where lower(plate_number) = lower(trim(p_record->>'plateNumber')) and is_active = true limit 1;
  if v_truck.id is null then raise exception 'INVALID_TRUCK: select an active Fleet record'; end if;

  -- Client is optional / delayed
  if nullif(trim(p_record->>'clientName'), '') is not null then
    select id into v_client_id from public.clients
      where lower(name) = lower(trim(p_record->>'clientName')) and is_active = true limit 1;
  end if;

  -- Waybill: Required for Owned, optional for Subcontracted (auto-generate placeholder if missing)
  v_waybill := trim(coalesce(p_record->>'waybillNumber', ''));
  if v_waybill = '' then
    if v_truck.ownership_type = 'Subcontracted' then
      v_waybill := 'WB-SUBCON-' || upper(substr(gen_random_uuid()::text, 1, 8));
    else
      v_waybill := 'WB-TEMP-' || upper(substr(gen_random_uuid()::text, 1, 8));
    end if;
  end if;

  -- Driver and Helper are optional / delayed
  if nullif(p_record->>'driverId', '') is not null then
    select id into v_driver_id from public.employees
      where id = (p_record->>'driverId')::uuid and assignment_type = 'Driver' and is_active = true;
  end if;
  if nullif(p_record->>'helperId', '') is not null then
    select id into v_helper_id from public.employees
      where id = (p_record->>'helperId')::uuid and assignment_type = 'Helper' and is_active = true;
  end if;

  -- Aggregate entry fees from p_dropoffs if p_record doesn't have entryFees
  if p_dropoffs is not null and jsonb_typeof(p_dropoffs) = 'array' and jsonb_array_length(p_dropoffs) > 0 then
    for v_stop in select * from jsonb_array_elements(p_dropoffs) loop
      v_dropoff_fee := coalesce(nullif(v_stop->>'entryFee', '')::numeric, 0);
      v_sum_entry := v_sum_entry + v_dropoff_fee;
      if (v_stop->>'entryFeeStatus') = 'unknown' then
        v_has_unknown_entry := true;
      end if;
    end loop;
    v_entry_fees := v_sum_entry;
    if v_has_unknown_entry then
      v_entry_status := 'unknown';
    else
      v_entry_status := 'confirmed';
    end if;
  end if;

  -- If p_record explicitly has entryFees or entryFeesStatus, let that override
  if nullif(p_record->>'entryFees', '') is not null then
    v_entry_fees := (p_record->>'entryFees')::numeric;
  end if;
  if nullif(p_record->>'entryFeesStatus', '') is not null then
    v_entry_status := (p_record->>'entryFeesStatus')::public.expense_resolution_status;
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
    v_waybill,
    coalesce(nullif(p_record->>'deliveryDate', '')::date, current_date),
    v_client_id,
    v_truck.id,
    v_driver_id,
    v_helper_id,
    v_truck.truck_type,
    nullif(trim(p_record->>'truckTemperature'), ''),
    v_truck.ownership_type,
    v_truck.rate_basis,
    coalesce(nullif(trim(p_record->>'origin'), ''), 'Pending Origin'),
    coalesce(nullif(p_record->>'distanceKm', '')::numeric, 0),
    coalesce(nullif(p_record->>'fuelRate', '')::numeric, 0),
    coalesce(nullif(p_record->>'dieselExpenses', '')::numeric, 0),
    coalesce(nullif(p_record->>'dieselExpensesStatus', '')::public.expense_resolution_status, 'confirmed'),
    coalesce(nullif(p_record->>'tollGateExpenses', '')::numeric, 0),
    coalesce(nullif(p_record->>'tollGateExpensesStatus', '')::public.expense_resolution_status, 'confirmed'),
    nullif(trim(p_record->>'tollGateBreakdown'), ''),
    coalesce(v_entry_fees, 0),
    coalesce(v_entry_status, 'confirmed'),
    coalesce(nullif(p_record->>'driverAllowance', '')::numeric, 0),
    coalesce(nullif(p_record->>'driverAllowanceStatus', '')::public.expense_resolution_status, 'confirmed'),
    coalesce(nullif(p_record->>'driverDailyRate', '')::numeric, 0),
    coalesce(nullif(p_record->>'driverDailyRateStatus', '')::public.expense_resolution_status, 'confirmed'),
    coalesce(nullif(p_record->>'helperAllowance', '')::numeric, 0),
    coalesce(nullif(p_record->>'helperAllowanceStatus', '')::public.expense_resolution_status, 'confirmed'),
    coalesce(nullif(p_record->>'helperDailyRate', '')::numeric, 0),
    coalesce(nullif(p_record->>'helperDailyRateStatus', '')::public.expense_resolution_status, 'confirmed'),
    coalesce(nullif(p_record->>'otherExpenses', '')::numeric, 0),
    coalesce(nullif(p_record->>'otherExpensesStatus', '')::public.expense_resolution_status, 'confirmed'),
    coalesce(nullif(p_record->>'deliveryRate', '')::numeric, 0),
    coalesce(nullif(p_record->>'podStatus', '')::public.pod_status, 'Pending'),
    coalesce(nullif(p_record->>'deliveryStatus', '')::public.delivery_status, 'Completed'),
    coalesce((p_record->>'recordingDelayed')::boolean, false),
    nullif(trim(p_record->>'notes'), ''),
    auth.uid()
  ) returning id into v_delivery_id;

  if p_dropoffs is not null and jsonb_typeof(p_dropoffs) = 'array' then
    for v_stop in select * from jsonb_array_elements(p_dropoffs) loop
      v_sequence := v_sequence + 1;
      v_dropoff_fee := nullif(v_stop->>'entryFee', '')::numeric;
      v_dropoff_status := coalesce(nullif(v_stop->>'entryFeeStatus', '')::public.expense_resolution_status, 'confirmed');
      insert into public.delivery_dropoffs (
        delivery_id, sequence_number, store_name, destination_area, dropoff_count,
        entry_fee, entry_fee_status, pod_submitted, supporting_docs_complete, remarks,
        delivery_status, document_ref
      ) values (
        v_delivery_id, v_sequence,
        coalesce(nullif(trim(v_stop->>'storeName'), ''), 'Pending Store'),
        coalesce(nullif(trim(v_stop->>'destinationArea'), ''), 'Pending Destination'),
        greatest(1, coalesce((v_stop->>'dropoffCount')::integer, 1)),
        v_dropoff_fee, v_dropoff_status,
        coalesce((v_stop->>'podSubmitted')::boolean, false),
        coalesce((v_stop->>'supportingDocsComplete')::boolean, false),
        nullif(trim(v_stop->>'remarks'), ''),
        coalesce(nullif(v_stop->>'deliveryStatus', '')::public.delivery_status, 'Completed'),
        coalesce(nullif(trim(v_stop->>'documentRef'), ''), 'Pending upload')
      );
    end loop;
  end if;

  if v_request_id is not null then
    insert into public.delivery_mutation_requests (idempotency_key, mutation_type, delivery_id, actor_id, result)
    values (v_request_id, 'create_delivery', v_delivery_id, auth.uid(), jsonb_build_object('deliveryId', v_delivery_id))
    on conflict (idempotency_key) do nothing;
  end if;

  return v_delivery_id;
end;
$$;
