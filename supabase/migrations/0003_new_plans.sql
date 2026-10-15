-- Reemplaza la grilla de planes; las filas existentes se reutilizan para no romper profiles.plan_id
update public.plans set name = '10 Mbps', speed_mbps = 10, price = 30000 where id = 1;
update public.plans set name = '15 Mbps', speed_mbps = 15, price = 35000 where id = 2;
update public.plans set name = '20 Mbps', speed_mbps = 20, price = 40000 where id = 3;
insert into public.plans (name, speed_mbps, price) values ('30 Mbps', 30, 46000), ('50 Mbps', 50, 58000);

-- Lo pendiente se cobra con el precio nuevo
update public.invoices i set amount = pl.price
from public.profiles pr join public.plans pl on pl.id = pr.plan_id
where i.user_id = pr.id and i.status = 'pending';
