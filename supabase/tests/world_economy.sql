-- Read-only regression checks for the persistent world economy migration.
-- Run after applying migrations to a local/staging database:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/world_economy.sql
do $$
declare
  v_def text;
  v_count integer;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='economy_asset_catalog' and c.relrowsecurity
  ) then raise exception 'economy_asset_catalog must have RLS enabled'; end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='player_economy_assets' and c.relrowsecurity
  ) then raise exception 'player_economy_assets must have RLS enabled'; end if;

  select count(*) into v_count from public.economy_asset_catalog where active;
  if v_count < 6 then raise exception 'expected six seeded world assets, found %', v_count; end if;

  if has_table_privilege('authenticated','public.player_economy_assets','INSERT')
     or has_table_privilege('authenticated','public.player_economy_assets','UPDATE')
     or has_table_privilege('authenticated','public.player_economy_assets','DELETE')
  then raise exception 'clients must not directly mutate player economy assets'; end if;

  if not has_function_privilege('authenticated','public.buy_or_upgrade_economy_asset(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.claim_economy_income()','EXECUTE')
  then raise exception 'authenticated economy RPC grants are missing'; end if;

  if has_function_privilege('anon','public.buy_or_upgrade_economy_asset(text)','EXECUTE')
     or has_function_privilege('anon','public.claim_economy_income()','EXECUTE')
  then raise exception 'anonymous direct asset mutation must be denied'; end if;

  if not has_function_privilege('anon','public.get_economy_leaderboard(text,integer)','EXECUTE')
  then raise exception 'public economy leaderboard must be readable'; end if;

  select pg_get_functiondef('public.buy_or_upgrade_economy_asset(text)'::regprocedure) into v_def;
  if position('pg_advisory_xact_lock' in v_def)=0
     or position('internal_adjust' in v_def)=0
  then raise exception 'purchase/upgrade must serialize and use the wallet ledger'; end if;

  select pg_get_functiondef('public.claim_economy_income()'::regprocedure) into v_def;
  if position('for update' in lower(v_def))=0
     or position('internal_adjust' in v_def)=0
  then raise exception 'income claim must lock owned assets and use the wallet ledger'; end if;

  select pg_get_functiondef('public.get_economy_leaderboard(text,integer)'::regprocedure) into v_def;
  if position('email' in lower(v_def))>0
  then raise exception 'public leaderboard must not expose email fields'; end if;
end;
$$;
