-- TEMPORAL: precios de $100 para probar credenciales de producción de Mercado Pago.
update public.plans set price = 100;
update public.invoices set amount = 100 where status = 'pending';

-- Para volver a los precios reales, correr:
-- update public.plans set price = case speed_mbps when 10 then 30000 when 15 then 35000
--   when 20 then 40000 when 30 then 46000 when 50 then 58000 end;
-- update public.invoices i set amount = pl.price
--   from public.profiles pr join public.plans pl on pl.id = pr.plan_id
--   where i.user_id = pr.id and i.status = 'pending';
