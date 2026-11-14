create or replace function public.admin_get_recent_casino_activity(p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('casino.view') then raise exception 'permission denied' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (
    select 'table_bet'::text as kind,b.created_at,b.user_id,b.stake,b.payout,b.net,b.status as result,r.game_type,b.choice as detail
    from public.casino_bets b join public.casino_rounds r on r.id=b.round_id
    union all
    select 'slot_spin',s.created_at,s.user_id,s.stake,s.payout,s.net,case when s.payout>0 then 'won' else 'lost' end,'slots',array_to_string(s.symbols,' ')
    from public.casino_slot_spins s
    union all
    select 'player_duel',c.created_at,c.challenger_id,c.stake,
      case when c.winner_id=c.challenger_id then c.stake*2 else 0 end,
      case when c.winner_id=c.challenger_id then c.stake when c.winner_id is null then 0 else -c.stake end,
      c.status,c.game_type,c.outcome
    from public.casino_challenges c where c.status='settled'
    union all
    select 'player_duel',c.created_at,c.opponent_id,c.stake,
      case when c.winner_id=c.opponent_id then c.stake*2 else 0 end,
      case when c.winner_id=c.opponent_id then c.stake when c.winner_id is null then 0 else -c.stake end,
      c.status,c.game_type,c.outcome
    from public.casino_challenges c where c.status='settled'
    order by created_at desc limit greatest(1,least(coalesce(p_limit,30),100))
  ) x);
end $$;
revoke all on function public.admin_get_recent_casino_activity(integer) from public,anon,authenticated;
grant execute on function public.admin_get_recent_casino_activity(integer) to authenticated;
