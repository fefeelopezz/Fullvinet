alter table public.profiles drop constraint only_owner_is_admin;
alter table public.profiles add constraint only_owner_is_admin
  check (role <> 'admin' or email in ('canorigor10@gmail.com', 'orioncanor11@gmail.com'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email = 'orioncanor11@gmail.com' then
    insert into public.profiles (id, full_name, email, role) values (new.id, 'Administrador', new.email, 'admin');
    return new;
  end if;
  raise exception 'El registro de cuentas está deshabilitado';
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,
  detail text
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
