-- Persistent property, business and simulated crypto-mining progression.
-- All ownership, upgrades, income claims and leaderboard calculations are server-authoritative.
create table public.economy_asset_catalog (
  asset_key text primary key check (asset_key ~ '^[a-z][a-z0-9_]{2,47}$'),
  asset_type text not null check (asset_type in ('property','business','mining_rig')),
  name text not null,
  description text not null default '',
  base_price bigint not null check (base_price > 0),
  income_per_cycle bigint not null check (income_per_cycle >= 0),
  cycle_hours smallint not null check (cycle_hours between 1 and 24),
  max_level smallint not null default 5 check (max_level between 1 and 20),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.player_economy_assets (
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_key text not null references public.economy_asset_catalog(asset_key),
  level smallint not null default 1 check (level between 1 and 20),
  acquired_at timestamptz not null default now(),
  last_claim_at timestamptz not null default now(),
  primary key (user_id, asset_key)
);

create index player_economy_assets_user_idx
  on public.player_economy_assets(user_id, asset_key);
create index economy_asset_catalog_type_idx
  on public.economy_asset_catalog(asset_type, active);

alter table public.economy_asset_catalog enable row level security;
alter table public.player_economy_assets enable row level security;

create policy "Economy asset catalogue is public"
  on public.economy_asset_catalog for select to anon, authenticated using (active = true);
create policy "Players can view their own economy assets"
  on public.player_economy_assets for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.economy_asset_catalog to anon, authenticated;
grant select on public.player_economy_assets to authenticated;
revoke insert, update, delete on public.economy_asset_catalog from anon, authenticated;
revoke insert, update, delete on public.player_economy_assets from anon, authenticated;

insert into public.economy_asset_catalog
  (asset_key, asset_type, name, description, base_price, income_per_cycle, cycle_hours, max_level)
values
  ('starter_flat', 'property', 'Starter Flat', 'A modest first property that earns steady rent.', 5000, 45, 1, 5),
  ('townhouse', 'property', 'Townhouse', 'A larger property with stronger rent potential.', 25000, 180, 2, 5),
  ('corner_cafe', 'business', 'Corner Café', 'A small local business with reliable recurring revenue.', 15000, 350, 4, 5),
  ('repair_garage', 'business', 'Repair Garage', 'A busy workshop that pays more between collections.', 45000, 1100, 4, 5),
  ('basic_miner', 'mining_rig', 'Basic Mining Rig', 'A simulated hash rig that earns virtual coins over time.', 12000, 120, 2, 5),
  ('server_rack', 'mining_rig', 'Server Rack', 'A larger simulated mining setup with higher upkeep-free output.', 60000, 900, 2, 5)
on conflict (asset_key) do nothing;

create or replace function public.buy_or_upgrade_economy_asset(p_asset_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_asset public.economy_asset_catalog%rowtype;
  v_owned public.player_economy_assets%rowtype;
  v_cost bigint;
  v_balance bigint;
  v_level smallint;
  v_action text;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_asset_key is null or length(p_asset_key) > 48 then
    raise exception 'choose a valid asset' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::text || ':economy:' || p_asset_key, 0)
  );

  select * into v_asset
  from public.economy_asset_catalog
  where asset_key = p_asset_key and active = true
  for share;
  if not found then raise exception 'asset is not available' using errcode = 'P0001'; end if;

  select * into v_owned
  from public.player_economy_assets
  where user_id = v_uid and asset_key = p_asset_key
  for update;

  if found then
    if v_owned.level >= v_asset.max_level then
      raise exception 'this asset is already at maximum level' using errcode = 'P0001';
    end if;
    v_level := v_owned.level + 1;
    v_action := 'upgrade';
  else
    v_level := 1;
    v_action := 'purchase';
  end if;

  v_cost := v_asset.base_price * case when v_action = 'purchase' then 1 else v_owned.level end;

  select balance into v_balance
  from public.wallets where user_id = v_uid for update;
  if v_balance is null or v_balance < v_cost then
    raise exception 'not enough coins; this costs %', v_cost using errcode = 'P0001';
  end if;

  perform public.internal_adjust(
    v_uid,
    -v_cost,
    'economy:' || v_action || ':' || p_asset_key || ':level:' || v_level::text
  );

  if v_action = 'purchase' then
    insert into public.player_economy_assets(user_id, asset_key, level)
    values (v_uid, p_asset_key, 1);
  else
    update public.player_economy_assets
    set level = v_level
    where user_id = v_uid and asset_key = p_asset_key;
  end if;

  return jsonb_build_object(
    'asset_key', p_asset_key,
    'asset_type', v_asset.asset_type,
    'action', v_action,
    'level', v_level,
    'cost', v_cost
  );
end;
$$;

create or replace function public.claim_economy_income()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet bigint;
  v_asset record;
  v_cycles integer;
  v_amount bigint;
  v_total bigint := 0;
  v_claims jsonb := '[]'::jsonb;
  v_claimed_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select balance into v_wallet
  from public.wallets where user_id = v_uid for update;
  if v_wallet is null then raise exception 'wallet not found' using errcode = 'P0001'; end if;

  for v_asset in
    select owned.asset_key, owned.level, owned.last_claim_at,
           catalog.name, catalog.income_per_cycle, catalog.cycle_hours
    from public.player_economy_assets owned
    join public.economy_asset_catalog catalog using (asset_key)
    where owned.user_id = v_uid and catalog.active = true
    order by owned.asset_key
    for update of owned
  loop
    v_cycles := least(
      floor(extract(epoch from (v_claimed_at - v_asset.last_claim_at)) / (v_asset.cycle_hours * 3600))::integer,
      greatest(1, floor(24 / v_asset.cycle_hours)::integer)
    );

    if v_cycles > 0 then
      v_amount := v_asset.income_per_cycle * v_asset.level * v_cycles;
      update public.player_economy_assets
      set last_claim_at = v_claimed_at
      where user_id = v_uid and asset_key = v_asset.asset_key;

      v_total := v_total + v_amount;
      v_claims := v_claims || jsonb_build_array(jsonb_build_object(
        'asset_key', v_asset.asset_key,
        'name', v_asset.name,
        'level', v_asset.level,
        'cycles', v_cycles,
        'coins', v_amount
      ));
    end if;
  end loop;

  if v_total > 0 then
    perform public.internal_adjust(v_uid, v_total, 'economy:passive_income');
  end if;

  return jsonb_build_object(
    'coins_claimed', v_total,
    'claims', v_claims,
    'claimed_at', v_claimed_at
  );
end;
$$;

create or replace function public.get_economy_leaderboard(
  p_category text default 'net_worth',
  p_limit integer default 25
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  score bigint,
  category text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_category text := coalesce(p_category, 'net_worth');
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if v_category not in ('coins', 'net_worth', 'level', 'xp') then
    raise exception 'unsupported leaderboard category' using errcode = '22023';
  end if;

  return query
  with totals as (
    select
      profile.id,
      profile.username,
      profile.display_name,
      wallet.balance,
      wallet.level,
      wallet.xp,
      coalesce(sum(catalog.base_price * owned.level), 0)::bigint as asset_value
    from public.profiles profile
    join public.wallets wallet on wallet.user_id = profile.id
    left join public.player_economy_assets owned on owned.user_id = profile.id
    left join public.economy_asset_catalog catalog on catalog.asset_key = owned.asset_key
    group by profile.id, profile.username, profile.display_name,
             wallet.balance, wallet.level, wallet.xp
  ), ranked as (
    select
      row_number() over (
        order by
          case when v_category = 'coins' then balance
               when v_category = 'net_worth' then balance + asset_value
               when v_category = 'level' then level::bigint
               else xp end desc,
          username asc
      ) as position,
      id, username, display_name,
      case when v_category = 'coins' then balance
           when v_category = 'net_worth' then balance + asset_value
           when v_category = 'level' then level::bigint
           else xp end as points
    from totals
  )
  select ranked.position, ranked.id, ranked.username,
         ranked.display_name, ranked.points, v_category
  from ranked
  order by ranked.position
  limit v_limit;
end;
$$;

revoke all on function public.buy_or_upgrade_economy_asset(text) from public, anon, authenticated;
revoke all on function public.claim_economy_income() from public, anon, authenticated;
revoke all on function public.get_economy_leaderboard(text, integer) from public, anon, authenticated;
grant execute on function public.buy_or_upgrade_economy_asset(text) to authenticated;
grant execute on function public.claim_economy_income() to authenticated;
grant execute on function public.get_economy_leaderboard(text, integer) to anon, authenticated;
