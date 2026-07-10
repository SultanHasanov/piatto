-- Offline devices may independently create the same human-facing order number.
-- Keep client_id as the idempotency key and assign a free display number on the server.
create or replace function public.assign_available_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_number integer;
begin
  -- Serialize numbering per shop, including simultaneous offline queue uploads.
  perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text, 0));

  if exists (
    select 1
    from public.orders
    where shop_id = new.shop_id
      and order_number = new.order_number
      and client_id <> new.client_id
  ) then
    select coalesce(max(order_number), 0) + 1
    into v_next_number
    from public.orders
    where shop_id = new.shop_id;

    new.order_number := v_next_number;
  end if;

  new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{number}', to_jsonb(new.order_number), true);

  update public.settings
  set data = jsonb_set(
        data,
        '{nextOrderNumber}',
        to_jsonb(greatest(coalesce((data->>'nextOrderNumber')::integer, 1), new.order_number + 1)),
        true
      ),
      version = version + 1,
      updated_at = now()
  where shop_id = new.shop_id;

  return new;
end;
$$;

drop trigger if exists assign_available_order_number_before_insert on public.orders;
create trigger assign_available_order_number_before_insert
before insert on public.orders
for each row execute function public.assign_available_order_number();

revoke all on function public.assign_available_order_number() from public;
