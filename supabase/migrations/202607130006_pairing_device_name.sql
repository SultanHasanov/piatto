alter table public.device_pairings add column if not exists device_name text;

create or replace function public.create_device_pairing(p_shop_id uuid, p_device_id uuid, p_admin_pin text, p_device_name text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_token text; v_code text; v_id uuid; v_expires timestamptz := now()+interval '10 minutes'; v_name text := left(trim(p_device_name),80);
begin
  if not exists(select 1 from public.devices where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid() and revoked_at is null) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.shop_security where shop_id=p_shop_id and admin_pin_hash=crypt(p_admin_pin, admin_pin_hash)) then raise exception 'Invalid admin PIN'; end if;
  if v_name is null or v_name = '' then raise exception 'Укажите название устройства'; end if;
  v_token := encode(gen_random_bytes(24),'hex'); v_code := lpad((floor(random()*1000000))::int::text,6,'0');
  insert into public.device_pairings(shop_id,token,short_code,expires_at,created_by,device_name) values(p_shop_id,v_token,v_code,v_expires,p_device_id,v_name) returning id into v_id;
  return jsonb_build_object('id',v_id,'token',v_token,'code',v_code,'expiresAt',v_expires,'deviceName',v_name);
end $$;

create or replace function public.register_paired_device(p_pairing_id uuid, p_user_id uuid, p_token text, p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_pair public.device_pairings; v_device_id uuid; v_name text;
begin
  select * into v_pair from public.device_pairings where id=p_pairing_id for update;
  if v_pair.id is null or not ((p_token is not null and v_pair.token=p_token) or (p_code is not null and v_pair.short_code=p_code)) then raise exception 'Код не найден'; end if;
  if v_pair.redeemed_at is not null or v_pair.expires_at<=now() then raise exception 'Код уже использован или истёк'; end if;
  v_name := coalesce(nullif(trim(v_pair.device_name),''),'Новое устройство');
  insert into public.shop_users(shop_id,user_id,role) values(v_pair.shop_id,p_user_id,'cashier');
  insert into public.devices(shop_id,auth_user_id,name) values(v_pair.shop_id,p_user_id,v_name) returning id into v_device_id;
  update public.device_pairings set redeemed_at=now() where id=v_pair.id;
  return v_device_id;
end $$;

grant execute on function public.create_device_pairing(uuid,uuid,text,text) to authenticated;
grant execute on function public.register_paired_device(uuid,uuid,text,text) to anon, authenticated;
