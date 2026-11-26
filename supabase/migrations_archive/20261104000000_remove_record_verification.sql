-- ============================================================================
-- Migration: 20261104000000_remove_record_verification.sql
-- RouteX: Remove Record Verification Workflow
--
-- Objective:
-- Simplify system workflows so delivery records are directly created, saved,
-- viewed, and edited without any verification, review, or approval gates.
--
-- Preserves:
-- - Delivery trip records, drop-offs, routes, and mileage.
-- - Financial finalization (finalized vs incomplete, expense resolution).
-- - POD & supporting document storage, uploads, viewing, downloads.
-- - Private bucket storage for document assets.
-- - Immutable audit logs and historical records.
-- ============================================================================

-- Document table adjustments:
-- Ensure delivery_dropoffs and document references remain directly accessible
comment on table public.delivery_dropoffs is
  'Multi-store drop-off stops with direct document attachment (POD and supporting files). No verification workflow required.';

comment on column public.deliveries.pod_status is
  'Legacy indicator for document attachment completeness. Verification workflows have been decommissioned.';

-- Update update_dropoff_document_state to focus strictly on document attachment
create or replace function public.update_dropoff_document_state(
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
    raise exception 'FORBIDDEN: Document management permission is required';
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

  select case
    when count(*) = 0 then 'Pending'
    when bool_and(pod_submitted) then 'Attached'
    when bool_or(pod_submitted) then 'Partial'
    else 'Missing' end into v_status
  from public.delivery_dropoffs where delivery_id = p_delivery_id;

  update public.deliveries set pod_status = v_status, version = version + 1, updated_at = now()
  where id = p_delivery_id and version = p_expected_version;
  if not found then raise exception 'VERSION_CONFLICT: delivery changed during document update'; end if;

  insert into public.delivery_activity
    (delivery_id, action, actor_id, changes, previous_version, resulting_version)
  values (p_delivery_id, 'Document Attached', auth.uid(), jsonb_build_object(
    'dropoffId', p_dropoff_id,
    'podSubmitted', p_pod_submitted,
    'documentRef', p_document_ref
  ), p_expected_version, p_expected_version + 1);

  return jsonb_build_object('podStatus', v_status, 'version', p_expected_version + 1);
end;
$$;

grant execute on function public.update_dropoff_document_state(uuid, uuid, integer, boolean, boolean, text) to authenticated;

