alter table public.zone_ips add column kind text not null default 'panel' check (kind in ('panel', 'enlace'));
insert into public.zone_ips (zone_id, ip, kind) select id, link_ip, 'enlace' from public.zones where link_ip is not null;
