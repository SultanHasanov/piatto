create extension if not exists pgcrypto;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_users (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'cashier' check (role in ('owner', 'manager', 'cashier')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create table public.settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  client_id uuid not null unique,
  data jsonb not null,
  version integer not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  client_id uuid not null,
  name text not null,
  sort integer not null default 0,
  data jsonb not null,
  version integer not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, client_id)
);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  client_id uuid not null,
  name text not null,
  required boolean not null default false,
  multi boolean not null default false,
  data jsonb not null,
  version integer not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, client_id)
);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  sort integer not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  client_id uuid not null,
  category_client_id uuid not null,
  name text not null,
  price numeric(12,2) not null,
  stock integer,
  disabled boolean not null default false,
  image_url text,
  data jsonb not null,
  version integer not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, client_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  client_id uuid not null,
  order_number integer not null,
  ordered_at timestamptz not null,
  total numeric(12,2) not null,
  payment_method text not null,
  order_type text not null,
  order_type_name text not null,
  order_type_surcharge numeric(12,2) not null default 0,
  status text not null check (status in ('paid', 'refunded')),
  data jsonb not null,
  version integer not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, client_id),
  unique (shop_id, order_number)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_client_id uuid not null,
  name text not null,
  quantity integer not null check (quantity > 0),
  base_price numeric(12,2) not null,
  total numeric(12,2) not null,
  sort integer not null default 0,
  data jsonb not null
);

create table public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  sort integer not null default 0
);

create table public.sync_operations (
  operation_id uuid primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  result jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index categories_shop_updated_idx on public.categories(shop_id, updated_at);
create index products_shop_updated_idx on public.products(shop_id, updated_at);
create index modifier_groups_shop_updated_idx on public.modifier_groups(shop_id, updated_at);
create index orders_shop_ordered_idx on public.orders(shop_id, ordered_at desc);
create index sync_operations_shop_created_idx on public.sync_operations(shop_id, created_at);

create or replace function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_users
    where shop_id = p_shop_id and user_id = auth.uid()
  );
$$;

alter table public.shops enable row level security;
alter table public.users enable row level security;
alter table public.shop_users enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_modifiers enable row level security;
alter table public.sync_operations enable row level security;

create policy shops_member_select on public.shops for select using (public.is_shop_member(id));
create policy users_same_shop_select on public.users for select using (
  id = auth.uid() or exists (
    select 1 from public.shop_users mine
    join public.shop_users theirs on theirs.shop_id = mine.shop_id
    where mine.user_id = auth.uid() and theirs.user_id = public.users.id
  )
);
create policy users_self_update on public.users for update using (id = auth.uid()) with check (id = auth.uid());
create policy shop_users_member_select on public.shop_users for select using (public.is_shop_member(shop_id));
create policy settings_member_all on public.settings for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy categories_member_all on public.categories for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy modifier_groups_member_all on public.modifier_groups for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy modifier_options_member_all on public.modifier_options for all
  using (exists (select 1 from public.modifier_groups g where g.id = group_id and public.is_shop_member(g.shop_id)))
  with check (exists (select 1 from public.modifier_groups g where g.id = group_id and public.is_shop_member(g.shop_id)));
create policy products_member_all on public.products for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy orders_member_all on public.orders for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy order_items_member_all on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id and public.is_shop_member(o.shop_id)))
  with check (exists (select 1 from public.orders o where o.id = order_id and public.is_shop_member(o.shop_id)));
create policy order_item_modifiers_member_all on public.order_item_modifiers for all
  using (exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id where i.id = order_item_id and public.is_shop_member(o.shop_id)))
  with check (exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id where i.id = order_item_id and public.is_shop_member(o.shop_id)));
create policy sync_operations_member_all on public.sync_operations for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.entity_with_version(p_data jsonb, p_version integer, p_deleted boolean)
returns jsonb
language sql
immutable
as $$
  select p_data || jsonb_build_object('version', p_version, 'deleted', p_deleted);
$$;

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
  ) entities;
  return v_result;
end;
$$;

create or replace function public.replace_modifier_options(p_group_id uuid, p_options jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_option jsonb;
  v_sort integer := 0;
begin
  delete from public.modifier_options where group_id = p_group_id;
  for v_option in select value from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) loop
    insert into public.modifier_options(group_id, name, price_delta, sort)
    values (p_group_id, v_option->>'name', coalesce((v_option->>'priceDelta')::numeric, 0), v_sort);
    v_sort := v_sort + 1;
  end loop;
end;
$$;

create or replace function public.replace_order_items(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_mod jsonb;
  v_item_id uuid;
  v_item_sort integer := 0;
  v_mod_sort integer;
begin
  delete from public.order_items where order_id = p_order_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.order_items(order_id, product_client_id, name, quantity, base_price, total, sort, data)
    values (
      p_order_id,
      (v_item->>'productClientId')::uuid,
      v_item->>'name',
      (v_item->>'qty')::integer,
      (v_item->>'basePrice')::numeric,
      (v_item->>'total')::numeric,
      v_item_sort,
      v_item
    ) returning id into v_item_id;
    v_mod_sort := 0;
    for v_mod in select value from jsonb_array_elements(coalesce(v_item->'mods', '[]'::jsonb)) loop
      insert into public.order_item_modifiers(order_item_id, name, price_delta, sort)
      values (v_item_id, v_mod->>'name', coalesce((v_mod->>'priceDelta')::numeric, 0), v_mod_sort);
      v_mod_sort := v_mod_sort + 1;
    end loop;
    v_item_sort := v_item_sort + 1;
  end loop;
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
    set total = (v_payload->>'total')::numeric, data = v_payload, version = version + 1, updated_at = now()
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy product_images_member_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

create policy product_images_public_read on storage.objects for select using (bucket_id = 'product-images');

create policy product_images_member_update on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_shop_member((storage.foldername(name))[1]::uuid))
with check (bucket_id = 'product-images' and public.is_shop_member((storage.foldername(name))[1]::uuid));

create policy product_images_member_delete on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_shop_member((storage.foldername(name))[1]::uuid));
