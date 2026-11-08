alter table public.profiles
  add column phone text unique check (phone ~ '^549[0-9]{10}$');

create table public.whatsapp_notices (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  kind text not null check (kind in ('antes', 'vencimiento')),
  sent_at timestamptz not null default now(),
  unique (invoice_id, kind)
);

alter table public.whatsapp_notices enable row level security;
