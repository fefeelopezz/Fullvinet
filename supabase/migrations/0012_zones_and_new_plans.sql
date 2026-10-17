create table public.zones (
  id bigint generated always as identity primary key,
  name text not null unique,
  link_ip text
);
create table public.zone_ips (
  id bigint generated always as identity primary key,
  zone_id bigint not null references public.zones on delete cascade,
  ip text not null,
  label text
);
create index zone_ips_zone_id_idx on public.zone_ips (zone_id);
alter table public.zones enable row level security;
alter table public.zone_ips enable row level security;

alter table public.profiles add column zone_id bigint references public.zones on delete set null;
create index profiles_zone_id_idx on public.profiles (zone_id);

insert into public.zones (name) values
  ('Campito'), ('Bravo'), ('Nehuen'), ('Eco Aldea'), ('Villa del Río'), ('Bodega Verdecchia'),
  ('Alta Barda'), ('Mar del Plata'), ('Don Emilio'), ('Joaquín Puerta'), ('Ercolani'), ('Granja');

update public.plans set price = 78000 where speed_mbps = 70;
insert into public.plans (name, speed_mbps, price) values ('90 Mbps', 90, 110000), ('100 Mbps', 100, 125000);
