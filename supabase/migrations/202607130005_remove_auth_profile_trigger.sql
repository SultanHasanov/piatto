-- Device accounts do not need a public profile. Membership and device records
-- are created atomically after Auth succeeds. Removing this legacy trigger also
-- prevents any public schema mismatch from aborting auth.users inserts.
drop trigger if exists on_auth_user_created on auth.users;
