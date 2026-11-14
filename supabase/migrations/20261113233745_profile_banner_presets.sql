alter table public.profiles
  add column banner_style text not null default 'starry'
  check (banner_style in ('starry','sakura','sea','ember','forest','void'));
