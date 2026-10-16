-- Los clientes ya no inician sesión: pasan a ser registros propios, sin cuenta de auth.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles alter column email drop not null;

-- Registro deshabilitado: el único usuario de login es el admin existente.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'El registro de cuentas está deshabilitado';
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Comprobante PDF del pago (ruta en el bucket privado "comprobantes")
alter table public.invoices add column receipt_path text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 4194304, array['application/pdf'])
on conflict (id) do nothing;

-- Planes definitivos; lo pendiente se cobra con el precio nuevo
update public.plans set price = case speed_mbps when 10 then 30000 when 15 then 35000
  when 20 then 40000 when 30 then 46000 when 50 then 58000 end;
update public.invoices i set amount = pl.price
  from public.profiles pr join public.plans pl on pl.id = pr.plan_id
  where i.user_id = pr.id and i.status = 'pending';
