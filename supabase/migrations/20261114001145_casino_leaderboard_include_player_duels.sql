-- Include both sides of settled player challenges in casino net-profit rankings.
create or replace function public.get_casino_leaderboard(p_limit integer default 20)
returns table(user_id uuid,username text,display_name text,games bigint,wins bigint,net_profit bigint)
language sql security definer set search_path=public,pg_temp as $$
  with results as (
    select b.user_id,b.net,(b.status='won') as won from public.casino_bets b where b.status in ('won','lost')
    union all
    select s.user_id,s.net,(s.payout>0) as won from public.casino_slot_spins s
    union all
    select c.challenger_id,
      case when c.winner_id=c.challenger_id then c.stake when c.winner_id is null then 0 else -c.stake end,
      c.winner_id=c.challenger_id
    from public.casino_challenges c where c.status='settled'
    union all
    select c.opponent_id,
      case when c.winner_id=c.opponent_id then c.stake when c.winner_id is null then 0 else -c.stake end,
      c.winner_id=c.opponent_id
    from public.casino_challenges c where c.status='settled'
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
