-- RouteX delivery notes support
-- Adds operational notes/remarks column to public.deliveries
begin;

alter table public.deliveries add column if not exists notes text;

-- Rebuild delivery_ledger view to explicitly include notes
drop view if exists public.delivery_ledger cascade;

create view public.delivery_ledger
with (security_invoker = true)
as
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
  driver.full_name as driver_name,
  helper.full_name as helper_name
from public.deliveries d
join public.clients c on c.id = d.client_id
join public.trucks t on t.id = d.truck_id
left join public.employees driver on driver.id = d.driver_id
left join public.employees helper on helper.id = d.helper_id;

grant select on public.delivery_ledger to authenticated;

commit;
