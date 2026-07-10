-- Выполните после создания первого пользователя в Supabase Auth.
-- Замените значения перед запуском.
do $$
declare
  v_shop_id uuid := '00000000-0000-0000-0000-000000000001';
  v_user_id uuid := '00000000-0000-0000-0000-000000000002';
begin
  insert into public.users(id, display_name) values (v_user_id, 'Владелец')
  on conflict (id) do nothing;

  insert into public.shops(id, name) values (v_shop_id, 'Piatto')
  on conflict (id) do nothing;

  insert into public.shop_users(shop_id, user_id, role) values (v_shop_id, v_user_id, 'owner')
  on conflict (shop_id, user_id) do nothing;
end $$;
