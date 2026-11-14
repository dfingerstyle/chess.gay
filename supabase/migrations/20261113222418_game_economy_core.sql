-- Core virtual economy and legacy game-record tables.
-- All balance changes are performed through trusted SECURITY DEFINER RPCs.
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 1000 check (balance >= 0),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.items (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('tool','fish','seed','crop','chess_perk')),
  rarity text not null default 'common' check (rarity in ('common','uncommon','rare','epic','legendary')),
  buy_price bigint check (buy_price is null or buy_price >= 0),
  sell_price bigint check (sell_price is null or sell_price >= 0),
  description text not null default ''
);

create table public.inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.items(id),
  qty integer not null default 0 check (qty >= 0),
  primary key (user_id, item_id)
);

create table public.cooldowns (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  available_at timestamptz not null,
  primary key (user_id, action)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid references public.profiles(id) on delete set null,
  black_id uuid references public.profiles(id) on delete set null,
  bot_level integer check (bot_level >= 1 and bot_level <= 10),
  bet bigint not null default 0 check (bet >= 0),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves text[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting','active','finished','cancelled')),
  result text check (result in ('white','black','draw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_white_idx on public.games (white_id);
create index games_black_idx on public.games (black_id);

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.items enable row level security;
alter table public.inventory enable row level security;
alter table public.cooldowns enable row level security;
alter table public.games enable row level security;

create policy "own wallet" on public.wallets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own transactions" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "items readable" on public.items
  for select to authenticated using (true);
create policy "own inventory" on public.inventory
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own cooldowns" on public.cooldowns
  for select to authenticated using (user_id = (select auth.uid()));
create policy "players see their games" on public.games
  for select to authenticated
  using (white_id = (select auth.uid()) or black_id = (select auth.uid()) or status = 'waiting');

grant select on public.wallets, public.transactions, public.items, public.inventory, public.cooldowns, public.games to authenticated;

insert into public.items (id,name,kind,rarity,buy_price,sell_price,description) values
  ('fishing_rod','Fishing Rod','tool','common',500,null,'Needed to fish.'),
  ('shovel','Shovel','tool','common',500,null,'Needed to farm.'),
  ('carrot_seed','Carrot Seed','seed','common',20,null,'Grows into a carrot.'),
  ('minnow','Minnow','fish','common',null,40,'Tiny but honest.'),
  ('bass','Bass','fish','uncommon',null,150,'A solid catch.'),
  ('golden_koi','Golden Koi','fish','legendary',null,5000,'Basically a lottery ticket.'),
  ('carrot','Carrot','crop','common',null,45,'Crunchy profit.'),
  ('extra_time','Extra Time','chess_perk','uncommon',300,null,'+30s on your chess clock in one game.');

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

create or replace function public.internal_adjust(p_user uuid, p_amount bigint, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_bal bigint;
begin
  update public.wallets
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_user
  returning balance into new_bal;
  if new_bal is null then raise exception 'wallet not found'; end if;
  insert into public.transactions (user_id, amount, reason) values (p_user, p_amount, p_reason);
  return new_bal;
end;
$$;

create or replace function public.do_work()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pay bigint;
  avail timestamptz;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select available_at into avail from public.cooldowns where user_id = uid and action = 'work';
  if avail is not null and avail > now() then raise exception 'work is on cooldown until %', avail; end if;
  pay := 100 + floor(random() * 151)::bigint;
  perform public.internal_adjust(uid, pay, 'work');
  insert into public.cooldowns (user_id, action, available_at)
  values (uid, 'work', now() + interval '1 hour')
  on conflict (user_id, action) do update set available_at = excluded.available_at;
  return pay;
end;
$$;
