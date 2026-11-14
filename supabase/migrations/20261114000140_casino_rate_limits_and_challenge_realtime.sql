-- Rate limits and realtime publication for casino social activity.
create or replace function private.guard_casino_table_creation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (select count(*) from public.casino_tables where host_id=new.host_id and status<>'closed')>=3 then
    raise exception 'you can host up to three active casino tables';
  end if;
  return new;
end $$;
create or replace function private.guard_casino_bet_rate()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (select count(*) from public.casino_bets where round_id=new.round_id and user_id=new.user_id)>=20 then
    raise exception 'maximum of 20 bets per player per round';
  end if;
  return new;
end $$;
create or replace function private.guard_casino_chat_rate()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (select count(*) from public.casino_chat_messages where user_id=new.user_id and created_at>now()-interval '10 seconds')>=5 then
    raise exception 'chat rate limit: wait before sending another message';
  end if;
  return new;
end $$;
create or replace function private.guard_casino_challenge_rate()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (select count(*) from public.casino_challenges where challenger_id=new.challenger_id and status='pending' and expires_at>now())>=3 then
    raise exception 'you can have up to three pending challenges';
  end if;
  return new;
end $$;
revoke all on function private.guard_casino_table_creation() from public,anon,authenticated;
revoke all on function private.guard_casino_bet_rate() from public,anon,authenticated;
revoke all on function private.guard_casino_chat_rate() from public,anon,authenticated;
revoke all on function private.guard_casino_challenge_rate() from public,anon,authenticated;
drop trigger if exists casino_table_creation_guard on public.casino_tables;
create trigger casino_table_creation_guard before insert on public.casino_tables for each row execute function private.guard_casino_table_creation();
drop trigger if exists casino_bet_rate_guard on public.casino_bets;
create trigger casino_bet_rate_guard before insert on public.casino_bets for each row execute function private.guard_casino_bet_rate();
drop trigger if exists casino_chat_rate_guard on public.casino_chat_messages;
create trigger casino_chat_rate_guard before insert on public.casino_chat_messages for each row execute function private.guard_casino_chat_rate();
drop trigger if exists casino_challenge_rate_guard on public.casino_challenges;
create trigger casino_challenge_rate_guard before insert on public.casino_challenges for each row execute function private.guard_casino_challenge_rate();
create index if not exists casino_bets_round_user_idx on public.casino_bets(round_id,user_id);
create index if not exists casino_chat_user_created_idx on public.casino_chat_messages(user_id,created_at desc);
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_challenges') then
    alter publication supabase_realtime add table public.casino_challenges;
  end if;
end $$;
