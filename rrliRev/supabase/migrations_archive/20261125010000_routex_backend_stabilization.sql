-- ============================================================================
-- Migration: 20261125010000_routex_backend_stabilization.sql
-- RouteX: Complete Backend Stabilization & SQL Dependency Parity
--
-- Objective:
-- 1. Allow nullable truck_temperature on public.trucks for dry / ambient fleet vehicles.
-- 2. Enhance SQL security definer role functions (is_superadmin, is_admin, can_write_operations,
--    can_read_operations) to properly support multi-role arrays (up.roles text[]) and Superadmin.
-- 3. Automatic financial completeness reconciliation trigger (auto-finalize when zero unknown expenses).
-- 4. Update create_delivery_record RPC to persist dropoff_count, general notes, and helper_id.
-- 5. Comprehensive explicit table, view, sequence, and routine grants across anon, authenticated, and service_role.
-- ============================================================================

begin;

-- 1. Fleet trucks temperature fix (allows ambient/dry trucks)
alter table public.trucks alter column truck_temperature drop not null;

-- 2. Enhanced role check functions supporting multi-role and superadmin
create or replace function public.is_superadmin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.is_superadmin = true
      and up.is_active = true
      and up.is_permanently_deleted = false
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and (up.is_superadmin = true or up.role = 'admin' or 'admin' = any(up.roles))
      and up.is_active = true
      and up.is_permanently_deleted = false
  );
$$;

create or replace function public.can_write_operations()
returns boolean language sql stable security definer as $$
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
  );
$$;

create or replace function public.can_read_operations()
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.is_active = true
      and up.is_permanently_deleted = false
  );
$$;

-- 3. Automatic financial completeness reconciliation trigger
create or replace function public.auto_reconcile_delivery_financial_state()
returns trigger language plpgsql as $$
begin
  if new.diesel_expenses_status = 'unknown' or
     new.toll_gate_expenses_status = 'unknown' or
     new.entry_fees_status = 'unknown' or
     new.driver_allowance_status = 'unknown' or
     new.driver_daily_rate_status = 'unknown' or
     new.helper_allowance_status = 'unknown' or
     new.helper_daily_rate_status = 'unknown' or
     new.other_expenses_status = 'unknown' then
    new.financial_state := 'incomplete';
    new.financial_finalized_at := null;
    new.financial_finalized_by := null;
  else
    new.financial_state := 'finalized';
    if new.financial_finalized_at is null then
      new.financial_finalized_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_reconcile_delivery_financial_state on public.deliveries;
create trigger trg_auto_reconcile_delivery_financial_state
  before insert or update on public.deliveries
  for each row
  execute function public.auto_reconcile_delivery_financial_state();

-- 4. Rebuild create_delivery_record with dropoff_count, notes, and helper_id
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
      where id = (p_record->>'driverId')::uuid and is_active = true limit 1;
  end if;
  if v_driver_id is null then raise exception 'INVALID_DRIVER: select or add an active driver'; end if;
  if nullif(p_record->>'helperId', '') is not null then
    select id into v_helper_id from public.employees
      where id = (p_record->>'helperId')::uuid and is_active = true limit 1;
  end if;
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
    waybill_number, delivery_date, recording_delayed, client_id, truck_id, driver_id, helper_id,
    truck_type_snapshot, truck_temperature_snapshot, truck_ownership_snapshot, rate_basis,
    origin, distance_km, fuel_rate, diesel_expenses, diesel_expenses_status,
    toll_gate_expenses, toll_gate_expenses_status, toll_gate_breakdown, entry_fees,
    entry_fees_status, driver_allowance, driver_allowance_status, driver_daily_rate,
    driver_daily_rate_status, helper_allowance, helper_allowance_status,
    helper_daily_rate, helper_daily_rate_status, other_expenses, other_expenses_status,
    delivery_rate, pod_status, financial_state, notes, created_by
  ) values (
    trim(p_record->>'waybillNumber'), (p_record->>'deliveryDate')::date,
    coalesce((p_record->>'recordingDelayed')::boolean, false), v_client_id, v_truck.id, v_driver_id, v_helper_id,
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
    (p_record->>'deliveryRate')::numeric, 'Pending', 'incomplete', nullif(trim(p_record->>'notes'), ''), auth.uid()
  ) returning id into v_delivery_id;

  for v_stop in select value from jsonb_array_elements(p_dropoffs) loop
    v_sequence := v_sequence + 1;
    insert into public.delivery_dropoffs (
      delivery_id, sequence_number, store_name, destination_area, dropoff_count, entry_fee,
      entry_fee_status, pod_submitted, supporting_docs_complete, document_ref
    ) values (
      v_delivery_id, v_sequence, trim(v_stop->>'storeName'), trim(v_stop->>'destinationArea'),
      greatest(1, coalesce((v_stop->>'dropoffCount')::integer, 1)),
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

-- 5. Complete Schema Grants
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role, postgres;
grant all on all sequences in schema public to service_role, postgres;
grant all on all routines in schema public to service_role, postgres;

grant select, insert, update, delete on table public.deliveries to authenticated;
grant select, insert, update, delete on table public.delivery_dropoffs to authenticated;
grant select, insert, update, delete on table public.delivery_documents to authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
grant select, insert, update, delete on table public.trucks to authenticated;
grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.company_expenses to authenticated;
grant select, insert, update, delete on table public.user_profiles to authenticated;

grant select on table public.deliveries to anon;
grant select on table public.delivery_dropoffs to anon;
grant select on table public.delivery_documents to anon;
grant select on table public.clients to anon;
grant select on table public.trucks to anon;
grant select on table public.employees to anon;
grant select on table public.delivery_ledger to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

commit;
