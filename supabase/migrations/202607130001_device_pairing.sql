create table public.shop_security (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  work_pin_hash text not null,
  admin_pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_primary boolean not null default false,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, auth_user_id)
);

create table public.device_pairings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  token text not null unique,
  short_code text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_by uuid not null references public.devices(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shop_security enable row level security;
alter table public.devices enable row level security;
alter table public.device_pairings enable row level security;
create policy devices_member_select on public.devices for select using (public.is_shop_member(shop_id));

create or replace function public.has_device_security(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.shop_security where shop_id = p_shop_id);
$$;

create or replace function public.bootstrap_device(p_shop_id uuid, p_name text, p_work_pin text, p_admin_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not public.is_shop_member(p_shop_id) then raise exception 'Access denied'; end if;
  if p_work_pin !~ '^\d{4}$' or p_admin_pin !~ '^\d{4}$' then raise exception 'PIN must contain 4 digits'; end if;
  insert into public.shop_security(shop_id, work_pin_hash, admin_pin_hash)
  values (p_shop_id, crypt(p_work_pin, gen_salt('bf')), crypt(p_admin_pin, gen_salt('bf')))
  on conflict (shop_id) do nothing;
  insert into public.devices(shop_id, auth_user_id, name, is_primary)
  values (p_shop_id, auth.uid(), left(trim(p_name), 80), true)
  on conflict (shop_id, auth_user_id) do update set revoked_at = null, last_seen_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.verify_device(p_shop_id uuid, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_device public.devices;
begin
  select * into v_device from public.devices where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid();
  if v_device.id is null or v_device.revoked_at is not null then return jsonb_build_object('active', false); end if;
  update public.devices set last_seen_at=now() where id=v_device.id;
  return jsonb_build_object('active', true, 'name', v_device.name, 'primary', v_device.is_primary);
end $$;

create or replace function public.unlock_device(p_shop_id uuid, p_device_id uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists(select 1 from public.devices where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid() and revoked_at is null) then return false; end if;
  return exists(select 1 from public.shop_security where shop_id=p_shop_id and work_pin_hash=crypt(p_pin, work_pin_hash));
end $$;

create or replace function public.create_device_pairing(p_shop_id uuid, p_device_id uuid, p_admin_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_token text; v_code text; v_id uuid; v_expires timestamptz := now()+interval '10 minutes';
begin
  if not exists(select 1 from public.devices where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid() and revoked_at is null) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.shop_security where shop_id=p_shop_id and admin_pin_hash=crypt(p_admin_pin, admin_pin_hash)) then raise exception 'Invalid admin PIN'; end if;
  v_token := encode(gen_random_bytes(24),'hex'); v_code := lpad((floor(random()*1000000))::int::text,6,'0');
  insert into public.device_pairings(shop_id,token,short_code,expires_at,created_by) values(p_shop_id,v_token,v_code,v_expires,p_device_id) returning id into v_id;
  return jsonb_build_object('id',v_id,'token',v_token,'code',v_code,'expiresAt',v_expires);
end $$;

create or replace function public.list_devices(p_shop_id uuid, p_device_id uuid, p_admin_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists(select 1 from public.devices where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid() and revoked_at is null) or
     not exists(select 1 from public.shop_security where shop_id=p_shop_id and admin_pin_hash=crypt(p_admin_pin,admin_pin_hash)) then raise exception 'Access denied'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'primary',is_primary,'lastSeenAt',last_seen_at,'createdAt',created_at,'revokedAt',revoked_at) order by created_at),'[]') from public.devices where shop_id=p_shop_id);
end $$;

create or replace function public.revoke_device(p_shop_id uuid, p_device_id uuid, p_target_id uuid, p_admin_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_user_id uuid;
begin
  if not exists(select 1 from public.devices where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid() and revoked_at is null) or
     not exists(select 1 from public.shop_security where shop_id=p_shop_id and admin_pin_hash=crypt(p_admin_pin,admin_pin_hash)) then raise exception 'Access denied'; end if;
  if exists(select 1 from public.devices where id=p_target_id and shop_id=p_shop_id and is_primary) then raise exception 'Primary device cannot be revoked'; end if;
  update public.devices set revoked_at=now() where id=p_target_id and shop_id=p_shop_id returning auth_user_id into v_user_id;
  delete from public.shop_users where shop_id=p_shop_id and user_id=v_user_id;
end $$;

grant execute on function public.has_device_security(uuid) to anon, authenticated;
grant execute on function public.bootstrap_device(uuid,text,text,text) to authenticated;
grant execute on function public.verify_device(uuid,uuid) to authenticated;
grant execute on function public.unlock_device(uuid,uuid,text) to authenticated;
grant execute on function public.create_device_pairing(uuid,uuid,text) to authenticated;
grant execute on function public.list_devices(uuid,uuid,text) to authenticated;
grant execute on function public.revoke_device(uuid,uuid,uuid,text) to authenticated;
