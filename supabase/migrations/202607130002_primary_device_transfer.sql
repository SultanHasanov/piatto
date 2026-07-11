create or replace function public.transfer_primary_device(
  p_shop_id uuid,
  p_device_id uuid,
  p_target_id uuid,
  p_admin_pin text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from public.devices
    where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid()
      and is_primary and revoked_at is null
  ) then raise exception 'Only the primary device can transfer ownership'; end if;
  if not exists (
    select 1 from public.shop_security
    where shop_id=p_shop_id and admin_pin_hash=crypt(p_admin_pin,admin_pin_hash)
  ) then raise exception 'Invalid admin PIN'; end if;
  if not exists (
    select 1 from public.devices where id=p_target_id and shop_id=p_shop_id and revoked_at is null
  ) then raise exception 'Target device is not active'; end if;
  update public.devices set is_primary=(id=p_target_id) where shop_id=p_shop_id;
end $$;

create or replace function public.emergency_claim_primary(
  p_shop_id uuid,
  p_device_id uuid,
  p_admin_pin text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from public.devices
    where id=p_device_id and shop_id=p_shop_id and auth_user_id=auth.uid() and revoked_at is null
  ) then raise exception 'This device is not active'; end if;
  if not exists (
    select 1 from public.shop_security
    where shop_id=p_shop_id and admin_pin_hash=crypt(p_admin_pin,admin_pin_hash)
  ) then raise exception 'Invalid admin PIN'; end if;
  update public.devices set is_primary=(id=p_device_id) where shop_id=p_shop_id;
end $$;

grant execute on function public.transfer_primary_device(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.emergency_claim_primary(uuid,uuid,text) to authenticated;
