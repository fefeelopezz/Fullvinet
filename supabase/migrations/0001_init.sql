-- Planes de internet
create table public.plans (
  id bigint generated always as identity primary key,
  name text not null,
  speed_mbps int not null,
  price numeric(12,2) not null check (price > 0)
);

-- Un perfil por usuario de auth
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  plan_id bigint references public.plans,
  created_at timestamptz not null default now()
);
create index profiles_plan_id_idx on public.profiles (plan_id);

-- Facturas mensuales
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  period date not null,
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  mp_payment_id text,
  paid_at timestamptz,
  unique (user_id, period)
);

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.invoices enable row level security;

-- El formulario de registro lista los planes
create policy "plans readable" on public.plans for select to anon, authenticated using (true);
create policy "own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own invoices" on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
-- Escrituras y lectura admin: solo desde el servidor con service role.

-- Al registrarse: crea perfil (rol siempre 'user') y la factura del mes en curso
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan bigint := nullif(new.raw_user_meta_data->>'plan_id','')::bigint;
begin
  insert into public.profiles (id, full_name, email, plan_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, v_plan);
  insert into public.invoices (user_id, period, amount)
  select new.id, date_trunc('month', now())::date, p.price from public.plans p where p.id = v_plan;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Genera la factura del mes para todos los clientes que aún no la tienen (idempotente)
create function public.create_monthly_invoices() returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.invoices (user_id, period, amount)
    select pr.id, date_trunc('month', now())::date, pl.price
    from public.profiles pr join public.plans pl on pl.id = pr.plan_id
    where pr.role = 'user'
    on conflict (user_id, period) do nothing
    returning 1
  ) select count(*)::int from ins;
$$;
revoke execute on function public.create_monthly_invoices() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.plans (name, speed_mbps, price) values
  ('Básico', 50, 15000),
  ('Hogar', 300, 25000),
  ('Fibra Pro', 1000, 40000);
