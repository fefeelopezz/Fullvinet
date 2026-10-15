-- Reemplaza el botón "Generar facturas del mes": corre solo el día 1 de cada mes (03:00 UTC)
create extension if not exists pg_cron;
select cron.schedule('facturas-mensuales', '0 3 1 * *', $$select public.create_monthly_invoices()$$);
