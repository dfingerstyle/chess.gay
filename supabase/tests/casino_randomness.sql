-- Read-only regression checks for server-side casino RNG and RPC grants.
-- Run after migrations against a local or staging database:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/casino_randomness.sql
begin;

do $$
declare
  v_arcade text := lower(pg_get_functiondef('public.play_arcade_game(text,bigint,text)'::regprocedure));
  v_slots text := lower(pg_get_functiondef('public.play_casino_slots(bigint)'::regprocedure));
begin
  -- Exhaustively verify the accepted byte ranges map evenly to every outcome.
  if (
    select count(*) from (
      select value % 37 as pocket
      from generate_series(0, 221) as value
      group by value % 37
      having count(*) <> 6
    ) buckets
  ) <> 0 or (
    select count(distinct value % 37) from generate_series(0, 221) as value
  ) <> 37 then
    raise exception 'roulette rejection sampling must map six byte values to each of 37 pockets';
  end if;

  if (
    select count(*) from (
      select value % 6 as face
      from generate_series(0, 251) as value
      group by value % 6
      having count(*) <> 42
    ) buckets
  ) <> 0 or (
    select count(distinct value % 6) from generate_series(0, 251) as value
  ) <> 6 then
    raise exception 'dice and slot rejection sampling must map 42 byte values to each of six outcomes';
  end if;

  if (
    select count(*) from generate_series(0, 127) as value
    where value < 64
  ) <> 64 or (
    select count(*) from generate_series(0, 127) as value
    where value >= 64
  ) <> 64 then
    raise exception 'coinflip byte split must be exactly 50/50';
  end if;

  if position('extensions.gen_random_bytes' in v_arcade) = 0 then
    raise exception 'play_arcade_game must use cryptographic random bytes';
  end if;
  if position('p_choice is null' in v_arcade) = 0 then
    raise exception 'play_arcade_game must reject null choices';
  end if;
  if v_arcade ~ '\mrandom\s*\(' then
    raise exception 'play_arcade_game must not use PostgreSQL pseudo-random functions';
  end if;
  if position('v_byte < 128' in v_arcade) = 0
    or position('v_byte < 252' in v_arcade) = 0
    or position('v_byte < 222' in v_arcade) = 0 then
    raise exception 'play_arcade_game is missing an unbiased rejection-sampling bound';
  end if;

  if position('extensions.gen_random_bytes' in v_slots) = 0 then
    raise exception 'play_casino_slots must use cryptographic random bytes';
  end if;
  if v_slots ~ '\mrandom\s*\(' then
    raise exception 'play_casino_slots must not use PostgreSQL pseudo-random functions';
  end if;
  if position('v_byte<252' in replace(v_slots, ' ', '')) = 0 then
    raise exception 'play_casino_slots must reject byte values that bias six symbols';
  end if;

  if has_function_privilege('anon', 'public.play_arcade_game(text,bigint,text)', 'EXECUTE') then
    raise exception 'anon must not execute play_arcade_game';
  end if;
  if not has_function_privilege('authenticated', 'public.play_arcade_game(text,bigint,text)', 'EXECUTE') then
    raise exception 'authenticated must execute play_arcade_game';
  end if;
  if has_function_privilege('anon', 'public.play_casino_slots(bigint)', 'EXECUTE') then
    raise exception 'anon must not execute play_casino_slots';
  end if;
  if not has_function_privilege('authenticated', 'public.play_casino_slots(bigint)', 'EXECUTE') then
    raise exception 'authenticated must execute play_casino_slots';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'guard_casino_table_creation',
        'guard_casino_bet_rate',
        'guard_casino_chat_rate',
        'guard_casino_challenge_rate'
      )
    group by n.nspname
    having count(*) = 4
  ) then
    raise exception 'expected all four casino rate-limit trigger functions';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'guard_casino_table_creation',
        'guard_casino_bet_rate',
        'guard_casino_chat_rate',
        'guard_casino_challenge_rate'
      )
      and position('pg_advisory_xact_lock' in lower(pg_get_functiondef(p.oid))) = 0
  ) then
    raise exception 'casino rate-limit guards must serialize concurrent requests';
  end if;
end;
$$;

rollback;
