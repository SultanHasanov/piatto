create or replace function public.lookup_device_pairing(p_shop_id uuid, p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_pair public.device_pairings;
begin
  select * into v_pair from public.device_pairings
  where shop_id=p_shop_id and ((p_token is not null and token=p_token) or (p_code is not null and short_code=p_code));
  if v_pair.id is null then raise exception 'Код не найден. Создайте новый код на главной кассе'; end if;
  if v_pair.redeemed_at is not null then raise exception 'Код уже был использован. Создайте новый код'; end if;
  if v_pair.expires_at <= now() then raise exception 'Срок действия кода истёк. Создайте новый код'; end if;
  return jsonb_build_object('id',v_pair.id,'shopId',v_pair.shop_id);
end $$;

create or replace function public.register_paired_device(p_pairing_id uuid, p_user_id uuid, p_name text, p_token text, p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_pair public.device_pairings; v_device_id uuid;
begin
  select * into v_pair from public.device_pairings where id=p_pairing_id for update;
  if v_pair.id is null or not ((p_token is not null and v_pair.token=p_token) or (p_code is not null and v_pair.short_code=p_code)) then raise exception 'Код не найден'; end if;
  if v_pair.redeemed_at is not null or v_pair.expires_at<=now() then raise exception 'Код уже использован или истёк'; end if;
  insert into public.shop_users(shop_id,user_id,role) values(v_pair.shop_id,p_user_id,'cashier');
  insert into public.devices(shop_id,auth_user_id,name) values(v_pair.shop_id,p_user_id,left(trim(p_name),80)) returning id into v_device_id;
  update public.device_pairings set redeemed_at=now() where id=v_pair.id;
  return v_device_id;
end $$;

grant execute on function public.lookup_device_pairing(uuid,text,text) to anon, authenticated;
grant execute on function public.register_paired_device(uuid,uuid,text,text,text) to anon, authenticated;
