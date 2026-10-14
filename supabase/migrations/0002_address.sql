alter table public.profiles add column address text;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan bigint := nullif(new.raw_user_meta_data->>'plan_id','')::bigint;
begin
  insert into public.profiles (id, full_name, email, address, plan_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email,
          nullif(trim(new.raw_user_meta_data->>'address'), ''), v_plan);
  insert into public.invoices (user_id, period, amount)
  select new.id, date_trunc('month', now())::date, p.price from public.plans p where p.id = v_plan;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
