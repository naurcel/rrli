-- ============================================================================
-- Migration: 20261125020000_fix_service_role_and_superadmin_rpc.sql
-- RouteX: Fix Service Role & Server-Verified Superadmin Authorization
--
-- Objective:
-- 1. Update can_write_operations, can_read_operations, is_admin, and is_superadmin
--    to recognize service_role / postgres backend callers executing on behalf of
--    verified server sessions (e.g. Next.js API route handlers).
-- 2. Allow nullable actor_id on delivery_mutation_requests.
-- 3. Update correct_delivery_financials, finalize_delivery_financials, and
--    update_dropoff_document_state to be security definer and safely handle
--    server-initiated calls where auth.uid() may be null.
-- ============================================================================

begin;

-- 1. Drop NOT NULL constraint on delivery_mutation_requests.actor_id
alter table public.delivery_mutation_requests alter column actor_id drop not null;

-- 2. Enhanced authorization functions recognizing backend service_role / postgres
create or replace function public.can_write_operations()
returns boolean language sql stable security definer as $$
  select (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (
      auth.uid() is not null
      and exists (
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
      )
    )
  );
$$;

create or replace function public.can_read_operations()
returns boolean language sql stable security definer as $$
  select (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.is_active = true
          and up.is_permanently_deleted = false
      )
    )
    or coalesce(auth.role(), 'anon') = 'anon'
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and (up.is_superadmin = true or up.role = 'admin' or 'admin' = any(up.roles))
          and up.is_active = true
          and up.is_permanently_deleted = false
      )
    )
  );
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer as $$
  select (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.is_superadmin = true
          and up.is_active = true
          and up.is_permanently_deleted = false
      )
    )
  );
$$;

-- 3. Rebuild correct_delivery_financials with security definer and safe actor handling
create or replace function public.correct_delivery_financials(
  p_delivery_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.deliveries%rowtype;
  v_after public.deliveries%rowtype;
  v_existing jsonb;
  v_actor_id uuid := auth.uid();
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: financial correction permission is required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'REASON_REQUIRED: provide a meaningful correction reason';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select result into v_existing from public.delivery_mutation_requests
    where idempotency_key = p_idempotency_key and (v_actor_id is null or actor_id = v_actor_id);
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
  values (p_delivery_id, 'Financial Correction', v_actor_id, jsonb_build_object(
    'previous', to_jsonb(v_before), 'updated', to_jsonb(v_after), 'requestedChanges', p_changes
  ), trim(p_reason), p_expected_version, p_expected_version + 1);

  v_existing := jsonb_build_object(
    'deliveryId', p_delivery_id, 'financialState', 'incomplete',
    'version', p_expected_version + 1
  );
  insert into public.delivery_mutation_requests
    (idempotency_key, mutation_type, delivery_id, actor_id, result)
  values (p_idempotency_key, 'correct_financials', p_delivery_id, v_actor_id, v_existing);
  return v_existing;
end;
$$;

-- 4. Rebuild finalize_delivery_financials with security definer and safe actor handling
create or replace function public.finalize_delivery_financials(
  p_delivery_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_existing jsonb;
  v_actor_id uuid := auth.uid();
begin
  if not public.can_write_operations() then
    raise exception 'FORBIDDEN: financial finalization permission is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select result into v_existing from public.delivery_mutation_requests
    where idempotency_key = p_idempotency_key and (v_actor_id is null or actor_id = v_actor_id);
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
      financial_finalized_by = v_actor_id, version = version + 1, updated_at = now()
  where id = p_delivery_id and version = p_expected_version;
  if not found then raise exception 'VERSION_CONFLICT: delivery changed during finalization'; end if;

  insert into public.delivery_activity
    (delivery_id, action, actor_id, changes, previous_version, resulting_version)
  values (p_delivery_id, 'Financials Finalized', v_actor_id, jsonb_build_object(
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
  values (p_idempotency_key, 'finalize_financials', p_delivery_id, v_actor_id, v_existing);
  return v_existing;
end;
$$;

-- 5. Rebuild update_dropoff_document_state with security definer
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
security definer
set search_path = public
as $$
declare
  v_status text;
  v_current_version integer;
  v_actor_id uuid := auth.uid();
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
  values (p_delivery_id, 'POD State Updated', v_actor_id, jsonb_build_object(
    'dropoffId', p_dropoff_id, 'podSubmitted', p_pod_submitted,
    'supportingDocsComplete', p_supporting_docs_complete, 'deliveryPodStatus', v_status
  ), p_expected_version, p_expected_version + 1);
  return jsonb_build_object('podStatus', v_status, 'version', p_expected_version + 1);
end;
$$;

-- 6. Grants
grant execute on function public.correct_delivery_financials(uuid, integer, jsonb, text, uuid) to anon, authenticated, service_role;
grant execute on function public.finalize_delivery_financials(uuid, integer, uuid) to anon, authenticated, service_role;
grant execute on function public.update_dropoff_document_state(uuid, uuid, integer, boolean, boolean, text) to anon, authenticated, service_role;
grant execute on function public.can_write_operations() to anon, authenticated, service_role;
grant execute on function public.can_read_operations() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_superadmin() to anon, authenticated, service_role;

commit;
