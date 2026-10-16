-- Único admin: canorigor10@gmail.com. La base rechaza cualquier otro perfil con rol admin.
update public.profiles set role = 'user' where role = 'admin' and email <> 'canorigor10@gmail.com';
update public.profiles set role = 'admin' where email = 'canorigor10@gmail.com';
alter table public.profiles add constraint only_owner_is_admin
  check (role <> 'admin' or email = 'canorigor10@gmail.com');

-- Su cuenta nunca se confirmó por email (no hay proveedor de correo)
update auth.users set email_confirmed_at = now()
  where email = 'canorigor10@gmail.com' and email_confirmed_at is null;
