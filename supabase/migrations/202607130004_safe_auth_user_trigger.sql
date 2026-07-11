create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.users(id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
    on conflict (id) do update set
      display_name = coalesce(excluded.display_name, public.users.display_name),
      updated_at = now();
  exception when others then
    -- A profile is optional. Auth user creation must not fail because of a
    -- legacy/mismatched public.users table; device registration follows in a
    -- separate, required transaction.
    raise warning 'Could not create public user profile for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
