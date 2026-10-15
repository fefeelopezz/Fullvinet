-- Número de antena del cliente; solo lo asigna el admin (los clientes no tienen policy de UPDATE)
alter table public.profiles add column antenna text;
