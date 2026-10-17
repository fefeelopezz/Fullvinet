alter table public.plans drop constraint plans_price_check;
alter table public.plans add constraint plans_price_check check (price >= 0);
insert into public.plans (name, speed_mbps, price) values ('70 Mbps', 70, 0);
