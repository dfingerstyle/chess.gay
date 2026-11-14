create or replace function public.admin_get_player_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_result jsonb; v_email text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('players.view') then raise exception 'permission denied' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'player not found'; end if;
  select case when private.admin_has_permission('players.email.view') then u.email else null end into v_email from auth.users u where u.id=p_user_id;
  select jsonb_build_object(
    'profile',(select to_jsonb(p) from public.profiles p where p.id=p_user_id),
    'email',v_email,'last_sign_in_at',(select last_sign_in_at from auth.users where id=p_user_id),
    'banned_until',(select banned_until from auth.users where id=p_user_id),
    'wallet',(select jsonb_build_object('balance',w.balance,'xp',w.xp,'level',w.level,'updated_at',w.updated_at) from public.wallets w where w.user_id=p_user_id),
    'roles',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'key',r.role_key,'name',r.name)),'[]'::jsonb) from public.admin_user_roles ur join public.admin_roles r on r.id=ur.role_id where ur.user_id=p_user_id),
    'transactions',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) from (select id,amount,reason,created_at from public.transactions where user_id=p_user_id order by created_at desc limit 20) t),
    'moderation',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc),'[]'::jsonb) from (select id,action_type,reason,status,created_at,expires_at,revoked_at from public.admin_moderation_actions where target_user_id=p_user_id order by created_at desc limit 20) m),
    'notes',(case when private.admin_has_permission('players.notes') then (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb) from (select id,author_id,note,created_at from public.admin_player_notes where user_id=p_user_id order by created_at desc limit 20) n) else '[]'::jsonb end),
    'casino_bets',(select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]'::jsonb) from (select id,table_id,bet_type,choice,stake,payout,net,status,created_at from public.casino_bets where user_id=p_user_id order by created_at desc limit 20) b),
    'slot_spins',(select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]'::jsonb) from (select id,stake,symbols,payout,net,created_at from public.casino_slot_spins where user_id=p_user_id order by created_at desc limit 20) s),
    'casino_challenges',(select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc),'[]'::jsonb) from (select id,case when challenger_id=p_user_id then opponent_id else challenger_id end as opponent_id,stake,game_type,challenger_choice,outcome,winner_id,status,created_at,settled_at from public.casino_challenges where challenger_id=p_user_id or opponent_id=p_user_id order by created_at desc limit 20) c)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.admin_get_player_detail(uuid) from public,anon,authenticated;
grant execute on function public.admin_get_player_detail(uuid) to authenticated;
