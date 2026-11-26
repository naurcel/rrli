-- ============================================================================
-- Migration: 20261125030000_fix_deliveries_financial_state_check.sql
-- Fix: Prevent batch import / auto-reconciliation failures on complete expenses.
-- Allows finalized records when financial_finalized_at is recorded without requiring auth.users FK,
-- and updates auto_reconcile_delivery_financial_state trigger to handle system/batch imports.
-- ============================================================================

begin;

alter table public.deliveries drop constraint if exists deliveries_financial_state_check;
alter table public.deliveries add constraint deliveries_financial_state_check check (
  financial_state = 'incomplete' or (
    total_expenses is not null and
    financial_finalized_at is not null
  )
);

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
    if new.financial_finalized_by is null and auth.uid() is not null then
      new.financial_finalized_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

commit;
