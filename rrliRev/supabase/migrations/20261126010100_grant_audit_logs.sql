-- 20261126010100_grant_audit_logs.sql
grant all on table public.audit_logs to service_role;
grant all on table public.audit_logs to postgres;
grant select, insert on table public.audit_logs to authenticated;
