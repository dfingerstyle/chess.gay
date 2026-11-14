-- Include all resolved casino table bets and slot spins in the same net-profit leaderboard.
create or replace function public.get_casino_leaderboard(p_limit integer default 20)
returns table(user_id uuid,username text,display_name text,games bigint,wins bigint,net_profit bigint)
language sql security definer set search_path=public,pg_temp as $$
  with results as (
    select b.user_id,b.net,(b.status='won') as won from public.casino_bets b where b.status in ('won','lost')
    union all
    select s.user_id,s.net,(s.payout>0) as won from public.casino_slot_spins s
  )
  select p.id,p.username,p.display_name,count(r.user_id)::bigint,
    count(r.user_id) filter(where r.won)::bigint,coalesce(sum(r.net),0)::bigint
  from public.profiles p join results r on r.user_id=p.id
  where (select auth.uid()) is not null
  group by p.id,p.username,p.display_name
  order by coalesce(sum(r.net),0) desc,count(r.user_id) desc
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;
revoke all on function public.get_casino_leaderboard(integer) from public,anon,authenticated;
grant execute on function public.get_casino_leaderboard(integer) to authenticated;
