-- ============================================================================
-- RouteX: Company-Wide Expense Ledger & Overall Profitability Tracking
-- Migration: 20261109000000_company_expenses.sql
-- ============================================================================

begin;

create table if not exists public.company_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(trim(description)) >= 2 and char_length(description) <= 200),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 100000000),
  expense_date date not null check (expense_date >= '2024-01-01'),
  category text not null default 'Other Operating Expenses',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_expenses_date_idx on public.company_expenses (expense_date desc);
create index if not exists company_expenses_category_idx on public.company_expenses (category);

alter table public.company_expenses enable row level security;

-- RLS Policies
create policy "company_expenses_select"
  on public.company_expenses
  for select
  using (public.can_view_workspace());

create policy "company_expenses_insert"
  on public.company_expenses
  for insert
  with check (public.can_write_operations());

create policy "company_expenses_update"
  on public.company_expenses
  for update
  using (public.can_write_operations())
  with check (public.can_write_operations());

create policy "company_expenses_delete"
  on public.company_expenses
  for delete
  using (public.can_write_operations());

-- Seed sample realistic company operational expenses (RRL Hub & Facilities 2026)
insert into public.company_expenses (id, description, amount, expense_date, category, notes, created_by, created_at, updated_at)
values
  ('50000000-0000-4000-8000-000000000001', 'Calamba Logistics Hub - Monthly Facility Rent', 45000.00, '2026-10-01', 'Rent & Facilities', 'Commercial lease payment for Q4 Calamba dispatch staging hub.', 'admin', '2026-10-01T08:00:00Z', '2026-10-01T08:00:00Z'),
  ('50000000-0000-4000-8000-000000000002', 'Meralco Electric Power - Calamba Cold Facility', 14250.80, '2026-10-15', 'Utilities', 'Electric billing for office facilities and cold room pre-cooling.', 'operations', '2026-10-15T09:30:00Z', '2026-10-15T09:30:00Z'),
  ('50000000-0000-4000-8000-000000000003', 'Enterprise Fiber Internet & Telecom (PLDT)', 3499.00, '2026-10-18', 'Utilities', 'Primary high-speed fiber dispatch line and cloud communications.', 'operations', '2026-10-18T10:15:00Z', '2026-10-18T10:15:00Z'),
  ('50000000-0000-4000-8000-000000000004', 'Dispatch Office Printing & RFID Tag Supplies', 2680.00, '2026-10-22', 'Office & Admin', 'Thermal paper rolls for waybills and RFID reload pouches.', 'operations', '2026-10-22T14:00:00Z', '2026-10-22T14:00:00Z'),
  ('50000000-0000-4000-8000-000000000005', 'Commercial Hub Property Insurance - October Premium', 8500.00, '2026-10-25', 'Insurance & Legal', 'General liability and property coverage for logistics yard.', 'admin', '2026-10-25T11:00:00Z', '2026-10-25T11:00:00Z'),
  ('50000000-0000-4000-8000-000000000006', 'Warehouse Staging Pallets & Heavy Jack Repair', 4200.00, '2026-10-28', 'Maintenance & Repairs', 'Hydraulic jack seal replacement and 10 heavy-duty plastic staging pallets.', 'operations', '2026-10-28T16:20:00Z', '2026-10-28T16:20:00Z'),
  ('50000000-0000-4000-8000-000000000007', 'Calamba Logistics Hub - Monthly Facility Rent', 45000.00, '2026-11-01', 'Rent & Facilities', 'Commercial lease payment for November 2026.', 'admin', '2026-11-01T08:30:00Z', '2026-11-01T08:30:00Z'),
  ('50000000-0000-4000-8000-000000000008', 'Enterprise Fiber Internet & Telecom (PLDT)', 3499.00, '2026-11-05', 'Utilities', 'Monthly fiber internet connectivity.', 'operations', '2026-11-05T09:00:00Z', '2026-11-05T09:00:00Z'),
  ('50000000-0000-4000-8000-000000000009', 'Office Drinking Water & Sanitation Supplies', 1250.00, '2026-11-06', 'Office & Admin', 'Water gallon refills and cleaning supplies for crew rest quarters.', 'operations', '2026-11-06T13:45:00Z', '2026-11-06T13:45:00Z')
on conflict (id) do nothing;

commit;
