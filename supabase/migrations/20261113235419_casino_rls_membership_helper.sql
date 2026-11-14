-- Replace recursive table-member RLS lookups with a private SECURITY DEFINER helper.
create or replace function private.is_casino_table_member(p_table_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
  select exists(select 1 from public.casino_table_members m where m.table_id=p_table_id and m.user_id=coalesce(p_user_id,auth.uid()));
$$;
revoke all on function private.is_casino_table_member(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_casino_table_member(uuid,uuid) to authenticated;

drop policy if exists "Casino tables visible to public or members" on public.casino_tables;
create policy "Casino tables visible to public or members" on public.casino_tables for select to authenticated
using (visibility='public' or private.is_casino_table_member(id,(select auth.uid())));
drop policy if exists "Casino members visible to table participants" on public.casino_table_members;
create policy "Casino members visible to table participants" on public.casino_table_members for select to authenticated
using (user_id=(select auth.uid()) or private.is_casino_table_member(table_id,(select auth.uid()))
  or exists(select 1 from public.casino_tables t where t.id=casino_table_members.table_id and t.visibility='public'));
drop policy if exists "Casino rounds visible to table participants" on public.casino_rounds;
create policy "Casino rounds visible to table participants" on public.casino_rounds for select to authenticated
using (exists(select 1 from public.casino_tables t where t.id=casino_rounds.table_id and t.visibility='public')
  or private.is_casino_table_member(table_id,(select auth.uid())));
drop policy if exists "Casino bets visible to owner or table participants" on public.casino_bets;
create policy "Casino bets visible to owner or table participants" on public.casino_bets for select to authenticated
using (user_id=(select auth.uid()) or exists(select 1 from public.casino_tables t where t.id=casino_bets.table_id and t.visibility='public')
  or private.is_casino_table_member(table_id,(select auth.uid())));
drop policy if exists "Casino chat visible to table participants" on public.casino_chat_messages;
create policy "Casino chat visible to table participants" on public.casino_chat_messages for select to authenticated
using (private.is_casino_table_member(table_id,(select auth.uid())));

create or replace function public.get_casino_leaderboard(p_limit integer default 20)
returns table(user_id uuid,username text,display_name text,games bigint,wins bigint,net_profit bigint)
language sql security definer set search_path=public,pg_temp as $$
  select p.id,p.username,p.display_name,count(b.id)::bigint,count(b.id) filter(where b.status='won')::bigint,coalesce(sum(b.net),0)::bigint
  from public.profiles p join public.casino_bets b on b.user_id=p.id
  where b.status in ('won','lost') and (select auth.uid()) is not null
  group by p.id,p.username,p.display_name
  order by coalesce(sum(b.net),0) desc,count(b.id) desc limit greatest(1,least(coalesce(p_limit,20),100));
$$;
