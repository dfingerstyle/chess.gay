-- Read-only regression checks for server-side casino RNG and RPC grants.
-- Run after migrations against a local or staging database:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/casino_randomness.sql
begin;

do $$
declare
  v_arcade text := lower(pg_get_functiondef('public.play_arcade_game(text,bigint,text)'::regprocedure));
  v_slots text := lower(pg_get_functiondef('public.play_casino_slots(bigint)'::regprocedure));
begin
  if position('extensions.gen_random_bytes' in v_arcade) = 0 then
    raise exception 'play_arcade_game must use cryptographic random bytes';
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
end;
$$;

rollback;
