-- Serialize casino rate-limit checks so concurrent requests cannot pass
-- the same count-then-insert guard at the same time.
create or replace function private.guard_casino_table_creation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.host_id::text, 0)
  );

  if (
    select count(*)
    from public.casino_tables
    where host_id = new.host_id and status <> 'closed'
  ) >= 3 then
    raise exception 'you can host up to three active casino tables';
  end if;

  return new;
end;
$$;

create or replace function private.guard_casino_bet_rate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.round_id::text || ':' || new.user_id::text, 0)
  );

  if (
    select count(*)
    from public.casino_bets
    where round_id = new.round_id and user_id = new.user_id
  ) >= 20 then
    raise exception 'maximum of 20 bets per player per round';
  end if;

  return new;
end;
$$;

create or replace function private.guard_casino_chat_rate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  if (
    select count(*)
    from public.casino_chat_messages
    where user_id = new.user_id
      and created_at > now() - interval '10 seconds'
  ) >= 5 then
    raise exception 'chat rate limit: wait before sending another message';
  end if;

  return new;
end;
$$;

create or replace function private.guard_casino_challenge_rate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.challenger_id::text, 0)
  );

  if (
    select count(*)
    from public.casino_challenges
    where challenger_id = new.challenger_id
      and status = 'pending'
      and expires_at > now()
  ) >= 3 then
    raise exception 'you can have up to three pending challenges';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_casino_table_creation() from public, anon, authenticated;
revoke all on function private.guard_casino_bet_rate() from public, anon, authenticated;
revoke all on function private.guard_casino_chat_rate() from public, anon, authenticated;
revoke all on function private.guard_casino_challenge_rate() from public, anon, authenticated;
