-- 20261126010000_audit_logs.sql
-- Persistent audit log storage for RouteX system events and compliance auditing

create table if not exists public.audit_logs (
  id text primary key,
  occurred_at timestamptz not null default now(),
  actor_id text not null,
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  changes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_occurred_at on public.audit_logs (occurred_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_action on public.audit_logs (action);

alter table public.audit_logs enable row level security;

create policy "Service role full access on audit_logs"
  on public.audit_logs
  for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated users can read audit_logs"
  on public.audit_logs
  for select
  to authenticated
  using (true);
