create or replace function public.admin_get_overview()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('dashboard.view') then raise exception 'permission denied' using errcode='42501'; end if;
  select jsonb_build_object(
    'players',(select count(*) from public.profiles),
    'new_players_7d',(select count(*) from public.profiles where created_at>now()-interval '7 days'),
    'active_players_24h',(select count(*) from auth.users where last_sign_in_at>now()-interval '24 hours'),
    'coins_circulating',(select coalesce(sum(balance),0) from public.wallets),
    'casino_active_tables',(select count(*) from public.casino_tables where status<>'closed'),
    'casino_bets_24h',(select count(*) from public.casino_bets where created_at>now()-interval '24 hours'),
    'casino_net_24h',
      (select coalesce(sum(net),0) from public.casino_bets where settled_at>now()-interval '24 hours')
      +(select coalesce(sum(net),0) from public.casino_slot_spins where created_at>now()-interval '24 hours'),
    'open_moderation_actions',(select count(*) from public.admin_moderation_actions where action_type in ('mute','suspend','ban') and status='active' and (expires_at is null or expires_at>now())),
    'admin_actions_24h',(select count(*) from public.admin_audit_logs where created_at>now()-interval '24 hours'),
    'active_chess_lobbies',(select count(*) from public.game_lobbies where status in ('waiting','active'))
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.admin_get_overview() from public,anon,authenticated;
grant execute on function public.admin_get_overview() to authenticated;
