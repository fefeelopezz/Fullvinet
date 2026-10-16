-- Comprobante del pago de Mercado Pago (medio, últimos 4, cuotas, pagador, monto, fecha)
alter table public.invoices add column mp_details jsonb;
