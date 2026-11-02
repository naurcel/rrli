begin;

do $$
declare
  v_total numeric;
  v_margin numeric;
begin
  v_total := public.calculate_delivery_expenses(
    0, 'confirmed', 0, 'confirmed', 0, 'confirmed', 0, 'confirmed',
    0, 'confirmed', 0, 'confirmed', 0, 'confirmed', 0, 'confirmed'
  );
  if v_total is distinct from 0 then
    raise exception 'confirmed zero parity failed: %', v_total;
  end if;

  v_total := public.calculate_delivery_expenses(
    10, 'confirmed', null, 'not_applicable', 0, 'confirmed', 0, 'confirmed',
    0, 'confirmed', 0, 'confirmed', 0, 'confirmed', 0, 'confirmed'
  );
  if v_total is distinct from 10 then
    raise exception 'not-applicable parity failed: %', v_total;
  end if;

  v_total := public.calculate_delivery_expenses(
    10, 'confirmed', null, 'unknown', 0, 'confirmed', 0, 'confirmed',
    0, 'confirmed', 0, 'confirmed', 0, 'confirmed', 0, 'confirmed'
  );
  if v_total is not null then
    raise exception 'unknown expense must produce null: %', v_total;
  end if;

  v_margin := public.calculate_profit_margin(0, 0);
  if v_margin is not null then
    raise exception 'zero revenue margin must be null: %', v_margin;
  end if;

  v_margin := public.calculate_profit_margin(1000, -250);
  if v_margin is distinct from -25 then
    raise exception 'negative margin parity failed: %', v_margin;
  end if;
end
$$;

rollback;
