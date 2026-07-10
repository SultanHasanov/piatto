-- Смены (кассовые смены с X/Z-отчётами) переводятся из чисто локального хранения
-- в общий синк-механизм — теперь видны на всех устройствах точки продаж.

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  client_id uuid not null,
  opened_at timestamptz not null,
  closed_at timestamptz,
  data jsonb not null,
  version integer not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, client_id)
);

alter table public.shifts enable row level security;

create policy shifts_member_all on public.shifts for all
  using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

create or replace function public.pull_shop_state(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_shop_member(p_shop_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entity), '[]'::jsonb) into v_result
  from (
    select public.entity_with_version(data, version, deleted) entity from public.categories where shop_id = p_shop_id
    union all
    select public.entity_with_version(data, version, deleted) from public.products where shop_id = p_shop_id
    union all
    select public.entity_with_version(data, version, deleted) from public.modifier_groups where shop_id = p_shop_id
    union all
    select public.entity_with_version(data, version, deleted) from public.orders where shop_id = p_shop_id
    union all
    select public.entity_with_version(data, version, deleted) from public.settings where shop_id = p_shop_id
    union all
    select public.entity_with_version(data, version, deleted) from public.shifts where shop_id = p_shop_id
  ) entities;
  return v_result;
end;
$$;

create or replace function public.apply_sync_operation(p_shop_id uuid, p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation_id uuid := (p_operation->>'id')::uuid;
  v_type text := p_operation->>'type';
  v_action text := p_operation->>'op';
  v_client_id uuid := (p_operation->>'clientId')::uuid;
  v_payload jsonb := p_operation->'payload';
  v_expected_version integer := coalesce((v_payload->>'version')::integer, 0);
  v_entity_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_product_client uuid;
  v_old_qty integer;
  v_new_qty integer;
  v_version integer;
  v_result jsonb;
begin
  if not public.is_shop_member(p_shop_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select result into v_result from public.sync_operations where operation_id = v_operation_id and shop_id = p_shop_id;
  if found then return v_result; end if;

  if p_operation->>'action' = 'checkout' then
    insert into public.orders(
      shop_id, client_id, order_number, ordered_at, total, payment_method, order_type,
      order_type_name, order_type_surcharge, status, data, updated_at
    ) values (
      p_shop_id, v_client_id, (v_payload->>'number')::integer, (v_payload->>'ts')::timestamptz,
      (v_payload->>'total')::numeric, v_payload->>'payment', v_payload->>'orderType',
      v_payload->>'orderTypeName', coalesce((v_payload->>'orderTypeSurcharge')::numeric, 0),
      'paid', v_payload, now()
    )
    on conflict (shop_id, client_id) do nothing
    returning id into v_order_id;

    if v_order_id is not null then
      perform public.replace_order_items(v_order_id, v_payload->'items');
      for v_item in select value from jsonb_array_elements(v_payload->'items') loop
        update public.products
        set stock = case when stock is null then null else stock - (v_item->>'qty')::integer end,
            data = case when stock is null then data else jsonb_set(data, '{stock}', to_jsonb(stock - (v_item->>'qty')::integer)) end,
            version = version + 1,
            updated_at = now()
        where shop_id = p_shop_id and client_id = (v_item->>'productClientId')::uuid and not deleted;
      end loop;
      update public.settings
      set data = jsonb_set(data, '{nextOrderNumber}', to_jsonb(greatest(coalesce((data->>'nextOrderNumber')::integer, 1), (v_payload->>'number')::integer + 1))),
          version = version + 1,
          updated_at = now()
      where shop_id = p_shop_id;
    end if;

    v_result := public.pull_shop_state(p_shop_id);
    insert into public.sync_operations(operation_id, shop_id, result) values (v_operation_id, p_shop_id, v_result);
    return v_result;
  elsif p_operation->>'action' = 'refund' then
    select id, version into v_order_id, v_version from public.orders
    where shop_id = p_shop_id and client_id = v_client_id for update;
    if v_order_id is null then raise exception 'Order not found' using errcode = 'P0002'; end if;
    if v_expected_version > 0 and v_version <> v_expected_version then
      raise exception 'Version conflict for order %', v_client_id using errcode = '40001';
    end if;
    if exists (select 1 from public.orders where id = v_order_id and status = 'paid') then
      for v_product_client, v_old_qty in
        select product_client_id, sum(quantity)::integer from public.order_items where order_id = v_order_id group by product_client_id
      loop
        update public.products
        set stock = case when stock is null then null else stock + v_old_qty end,
            data = case when stock is null then data else jsonb_set(data, '{stock}', to_jsonb(stock + v_old_qty)) end,
            version = version + 1,
            updated_at = now()
        where shop_id = p_shop_id and client_id = v_product_client and not deleted;
      end loop;
      update public.orders
      set status = 'refunded', data = v_payload, version = version + 1, updated_at = now()
      where id = v_order_id;
    end if;
    v_result := public.pull_shop_state(p_shop_id);
    insert into public.sync_operations(operation_id, shop_id, result) values (v_operation_id, p_shop_id, v_result);
    return v_result;
  elsif p_operation->>'action' = 'editOrder' then
    select id, version into v_order_id, v_version from public.orders
    where shop_id = p_shop_id and client_id = v_client_id and status = 'paid' for update;
    if v_order_id is null then raise exception 'Paid order not found' using errcode = 'P0002'; end if;
    if v_expected_version > 0 and v_version <> v_expected_version then
      raise exception 'Version conflict for order %', v_client_id using errcode = '40001';
    end if;

    for v_product_client in
      select product_client_id from public.order_items where order_id = v_order_id
      union
      select (value->>'productClientId')::uuid from jsonb_array_elements(v_payload->'items')
    loop
      select coalesce(sum(quantity), 0)::integer into v_old_qty
      from public.order_items where order_id = v_order_id and product_client_id = v_product_client;
      select coalesce(sum((value->>'qty')::integer), 0)::integer into v_new_qty
      from jsonb_array_elements(v_payload->'items') where (value->>'productClientId')::uuid = v_product_client;
      update public.products
      set stock = case when stock is null then null else stock + v_old_qty - v_new_qty end,
          data = case when stock is null then data else jsonb_set(data, '{stock}', to_jsonb(stock + v_old_qty - v_new_qty)) end,
          version = version + 1,
          updated_at = now()
      where shop_id = p_shop_id and client_id = v_product_client and not deleted;
    end loop;

    update public.orders
    set total = (v_payload->>'total')::numeric,
        payment_method = coalesce(v_payload->>'payment', payment_method),
        order_type = coalesce(v_payload->>'orderType', order_type),
        order_type_name = coalesce(v_payload->>'orderTypeName', order_type_name),
        order_type_surcharge = coalesce((v_payload->>'orderTypeSurcharge')::numeric, order_type_surcharge),
        data = v_payload, version = version + 1, updated_at = now()
    where id = v_order_id;
    perform public.replace_order_items(v_order_id, v_payload->'items');
    v_result := public.pull_shop_state(p_shop_id);
    insert into public.sync_operations(operation_id, shop_id, result) values (v_operation_id, p_shop_id, v_result);
    return v_result;
  end if;

  if v_action = 'update' and v_expected_version > 0 then
    if v_type = 'category' then select version into v_version from public.categories where shop_id = p_shop_id and client_id = v_client_id for update;
    elsif v_type = 'product' then select version into v_version from public.products where shop_id = p_shop_id and client_id = v_client_id for update;
    elsif v_type = 'modifierGroup' then select version into v_version from public.modifier_groups where shop_id = p_shop_id and client_id = v_client_id for update;
    elsif v_type = 'order' then select version into v_version from public.orders where shop_id = p_shop_id and client_id = v_client_id for update;
    elsif v_type = 'settings' then select version into v_version from public.settings where shop_id = p_shop_id for update;
    elsif v_type = 'shift' then select version into v_version from public.shifts where shop_id = p_shop_id and client_id = v_client_id for update;
    end if;
    if v_version is distinct from v_expected_version then
      raise exception 'Version conflict for % %', v_type, v_client_id using errcode = '40001';
    end if;
  end if;

  if v_type = 'category' then
    if v_action = 'delete' then
      update public.categories set deleted = true, version = version + 1, updated_at = now(),
        data = data || jsonb_build_object('deleted', true, 'updatedAt', now())
      where shop_id = p_shop_id and client_id = v_client_id
      returning public.entity_with_version(data, version, deleted) into v_result;
    else
      insert into public.categories(shop_id, client_id, name, sort, data, updated_at)
      values (p_shop_id, v_client_id, v_payload->>'name', coalesce((v_payload->>'sort')::integer, 0), v_payload, now())
      on conflict (shop_id, client_id) do update set
        name = excluded.name, sort = excluded.sort, data = excluded.data,
        deleted = false, version = public.categories.version + 1, updated_at = now()
      returning public.entity_with_version(data, version, deleted) into v_result;
    end if;
  elsif v_type = 'product' then
    if v_action = 'delete' then
      update public.products set deleted = true, version = version + 1, updated_at = now(),
        data = data || jsonb_build_object('deleted', true, 'updatedAt', now())
      where shop_id = p_shop_id and client_id = v_client_id
      returning public.entity_with_version(data, version, deleted) into v_result;
    else
      insert into public.products(shop_id, client_id, category_client_id, name, price, stock, disabled, image_url, data, updated_at)
      values (
        p_shop_id, v_client_id, (v_payload->>'categoryId')::uuid, v_payload->>'name',
        (v_payload->>'price')::numeric, nullif(v_payload->>'stock', '')::integer,
        coalesce((v_payload->>'disabled')::boolean, false), v_payload->>'image', v_payload, now()
      )
      on conflict (shop_id, client_id) do update set
        category_client_id = excluded.category_client_id, name = excluded.name, price = excluded.price,
        stock = excluded.stock, disabled = excluded.disabled, image_url = excluded.image_url,
        data = excluded.data, deleted = false, version = public.products.version + 1, updated_at = now()
      returning public.entity_with_version(data, version, deleted) into v_result;
    end if;
  elsif v_type = 'modifierGroup' then
    if v_action = 'delete' then
      update public.modifier_groups set deleted = true, version = version + 1, updated_at = now(),
        data = data || jsonb_build_object('deleted', true, 'updatedAt', now())
      where shop_id = p_shop_id and client_id = v_client_id
      returning public.entity_with_version(data, version, deleted) into v_result;
    else
      insert into public.modifier_groups(shop_id, client_id, name, required, multi, data, updated_at)
      values (p_shop_id, v_client_id, v_payload->>'name', coalesce((v_payload->>'required')::boolean, false), coalesce((v_payload->>'multi')::boolean, false), v_payload, now())
      on conflict (shop_id, client_id) do update set
        name = excluded.name, required = excluded.required, multi = excluded.multi,
        data = excluded.data, deleted = false, version = public.modifier_groups.version + 1, updated_at = now()
      returning id, public.entity_with_version(data, version, deleted) into v_entity_id, v_result;
      perform public.replace_modifier_options(v_entity_id, v_payload->'options');
    end if;
  elsif v_type = 'settings' then
    insert into public.settings(shop_id, client_id, data, updated_at)
    values (p_shop_id, v_client_id, v_payload, now())
    on conflict (shop_id) do update set
      client_id = excluded.client_id, data = excluded.data, deleted = false,
      version = public.settings.version + 1, updated_at = now()
    returning public.entity_with_version(data, version, deleted) into v_result;
  elsif v_type = 'order' then
    if v_action = 'delete' then
      update public.orders set deleted = true, version = version + 1, updated_at = now(),
        data = data || jsonb_build_object('deleted', true, 'updatedAt', now())
      where shop_id = p_shop_id and client_id = v_client_id
      returning public.entity_with_version(data, version, deleted) into v_result;
    else
      insert into public.orders(
        shop_id, client_id, order_number, ordered_at, total, payment_method, order_type,
        order_type_name, order_type_surcharge, status, data, updated_at
      ) values (
        p_shop_id, v_client_id, (v_payload->>'number')::integer, (v_payload->>'ts')::timestamptz,
        (v_payload->>'total')::numeric, v_payload->>'payment', v_payload->>'orderType',
        v_payload->>'orderTypeName', coalesce((v_payload->>'orderTypeSurcharge')::numeric, 0),
        v_payload->>'status', v_payload, now()
      )
      on conflict (shop_id, client_id) do update set
        total = excluded.total, payment_method = excluded.payment_method, order_type = excluded.order_type,
        order_type_name = excluded.order_type_name, order_type_surcharge = excluded.order_type_surcharge,
        status = excluded.status, data = excluded.data, deleted = false,
        version = public.orders.version + 1, updated_at = now()
      returning id, public.entity_with_version(data, version, deleted) into v_entity_id, v_result;
      perform public.replace_order_items(v_entity_id, v_payload->'items');
    end if;
  elsif v_type = 'shift' then
    if v_action = 'delete' then
      update public.shifts set deleted = true, version = version + 1, updated_at = now(),
        data = data || jsonb_build_object('deleted', true, 'updatedAt', now())
      where shop_id = p_shop_id and client_id = v_client_id
      returning public.entity_with_version(data, version, deleted) into v_result;
    else
      insert into public.shifts(shop_id, client_id, opened_at, closed_at, data, updated_at)
      values (
        p_shop_id, v_client_id, (v_payload->>'openedAt')::timestamptz,
        nullif(v_payload->>'closedAt', '')::timestamptz, v_payload, now()
      )
      on conflict (shop_id, client_id) do update set
        opened_at = excluded.opened_at, closed_at = excluded.closed_at, data = excluded.data,
        deleted = false, version = public.shifts.version + 1, updated_at = now()
      returning public.entity_with_version(data, version, deleted) into v_result;
    end if;
  else
    raise exception 'Unsupported entity type: %', v_type using errcode = '22023';
  end if;

  if v_result is null then
    v_result := jsonb_build_object('clientId', v_client_id, 'type', v_type, 'deleted', true);
  end if;
  v_result := jsonb_build_array(v_result);
  insert into public.sync_operations(operation_id, shop_id, result) values (v_operation_id, p_shop_id, v_result);
  return v_result;
end;
$$;

revoke all on function public.pull_shop_state(uuid) from public;
revoke all on function public.apply_sync_operation(uuid, jsonb) from public;
grant execute on function public.pull_shop_state(uuid) to authenticated;
grant execute on function public.apply_sync_operation(uuid, jsonb) to authenticated;
