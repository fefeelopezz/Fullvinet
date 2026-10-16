alter table public.profiles add column payment_method text
  check (payment_method in ('transferencia', 'efectivo', 'sin_cargo'));

alter table public.invoices alter column amount drop not null;

create or replace function public.create_monthly_invoices() returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.invoices (user_id, period, amount)
    select pr.id, date_trunc('month', now())::date, pl.price
    from public.profiles pr join public.plans pl on pl.id = pr.plan_id
    where pr.role = 'user' and pr.payment_method is distinct from 'sin_cargo'
    on conflict (user_id, period) do nothing
    returning 1
  ) select count(*)::int from ins;
$$;
revoke execute on function public.create_monthly_invoices() from public, anon, authenticated;
