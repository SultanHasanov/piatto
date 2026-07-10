-- One-time repair for demo catalogs uploaded by more than one browser/device.
-- Duplicates are matched by normalized names inside one shop. References in
-- products and historical orders are moved to the oldest canonical entity.

create temporary table category_dedup_map (
  shop_id uuid not null,
  duplicate_id uuid primary key,
  canonical_id uuid not null
) on commit drop;

insert into category_dedup_map(shop_id, duplicate_id, canonical_id)
select shop_id, client_id, canonical_id
from (
  select
    shop_id,
    client_id,
    first_value(client_id) over (
      partition by shop_id, lower(trim(name))
      order by created_at, id
    ) canonical_id,
    row_number() over (
      partition by shop_id, lower(trim(name))
      order by created_at, id
    ) position
  from public.categories
  where not deleted
) ranked
where position > 1;

update public.products product
set category_client_id = map.canonical_id,
    data = jsonb_set(product.data, '{categoryId}', to_jsonb(map.canonical_id::text), true),
    version = product.version + 1,
    updated_at = now()
from category_dedup_map map
where product.shop_id = map.shop_id
  and product.category_client_id = map.duplicate_id;

create temporary table product_dedup_map (
  shop_id uuid not null,
  duplicate_id uuid primary key,
  canonical_id uuid not null
) on commit drop;

insert into product_dedup_map(shop_id, duplicate_id, canonical_id)
select shop_id, client_id, canonical_id
from (
  select
    shop_id,
    client_id,
    first_value(client_id) over (
      partition by shop_id, category_client_id, lower(trim(name))
      order by created_at, id
    ) canonical_id,
    row_number() over (
      partition by shop_id, category_client_id, lower(trim(name))
      order by created_at, id
    ) position
  from public.products
  where not deleted
) ranked
where position > 1;

update public.order_items item
set product_client_id = map.canonical_id,
    data = jsonb_set(item.data, '{productClientId}', to_jsonb(map.canonical_id::text), true)
from product_dedup_map map
join public.orders order_row on order_row.shop_id = map.shop_id
where item.order_id = order_row.id
  and item.product_client_id = map.duplicate_id;

update public.orders order_row
set data = jsonb_set(
      order_row.data,
      '{items}',
      coalesce((
        select jsonb_agg(
          case
            when map.canonical_id is null then item.value
            else jsonb_set(item.value, '{productClientId}', to_jsonb(map.canonical_id::text), true)
          end
          order by item.ordinality
        )
        from jsonb_array_elements(coalesce(order_row.data->'items', '[]'::jsonb)) with ordinality item(value, ordinality)
        left join product_dedup_map map
          on map.shop_id = order_row.shop_id
         and map.duplicate_id = (item.value->>'productClientId')::uuid
      ), '[]'::jsonb),
      true
    ),
    version = order_row.version + 1,
    updated_at = now()
where exists (
  select 1
  from jsonb_array_elements(coalesce(order_row.data->'items', '[]'::jsonb)) item
  join product_dedup_map map
    on map.shop_id = order_row.shop_id
   and map.duplicate_id = (item->>'productClientId')::uuid
);

update public.products product
set deleted = true,
    data = product.data || jsonb_build_object('deleted', true, 'updatedAt', now()),
    version = product.version + 1,
    updated_at = now()
from product_dedup_map map
where product.shop_id = map.shop_id
  and product.client_id = map.duplicate_id;

update public.categories category
set deleted = true,
    data = category.data || jsonb_build_object('deleted', true, 'updatedAt', now()),
    version = category.version + 1,
    updated_at = now()
from category_dedup_map map
where category.shop_id = map.shop_id
  and category.client_id = map.duplicate_id;

create temporary table modifier_dedup_map (
  shop_id uuid not null,
  duplicate_id uuid primary key,
  canonical_id uuid not null
) on commit drop;

insert into modifier_dedup_map(shop_id, duplicate_id, canonical_id)
select shop_id, client_id, canonical_id
from (
  select
    shop_id,
    client_id,
    first_value(client_id) over (
      partition by shop_id, lower(trim(name))
      order by created_at, id
    ) canonical_id,
    row_number() over (
      partition by shop_id, lower(trim(name))
      order by created_at, id
    ) position
  from public.modifier_groups
  where not deleted
) ranked
where position > 1;

update public.products product
set data = jsonb_set(
      product.data,
      '{modifierGroupIds}',
      coalesce((
        select jsonb_agg(to_jsonb(coalesce(map.canonical_id::text, value.id)))
        from jsonb_array_elements_text(coalesce(product.data->'modifierGroupIds', '[]'::jsonb)) value(id)
        left join modifier_dedup_map map
          on map.shop_id = product.shop_id
         and map.duplicate_id = value.id::uuid
      ), '[]'::jsonb),
      true
    ),
    version = product.version + 1,
    updated_at = now()
where exists (
  select 1
  from jsonb_array_elements_text(coalesce(product.data->'modifierGroupIds', '[]'::jsonb)) value(id)
  join modifier_dedup_map map
    on map.shop_id = product.shop_id
   and map.duplicate_id = value.id::uuid
);

update public.modifier_groups modifier_group
set deleted = true,
    data = modifier_group.data || jsonb_build_object('deleted', true, 'updatedAt', now()),
    version = modifier_group.version + 1,
    updated_at = now()
from modifier_dedup_map map
where modifier_group.shop_id = map.shop_id
  and modifier_group.client_id = map.duplicate_id;
