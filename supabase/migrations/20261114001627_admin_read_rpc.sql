create or replace function public.admin_get_my_access()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_roles jsonb; v_permissions jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'key',r.role_key,'name',r.name) order by r.name),'[]'::jsonb)
  into v_roles from public.admin_user_roles ur join public.admin_roles r on r.id=ur.role_id where ur.user_id=v_uid;
  select coalesce(jsonb_agg(distinct rp.permission_key),'[]'::jsonb)
  into v_permissions from public.admin_user_roles ur join public.admin_role_permissions rp on rp.role_id=ur.role_id where ur.user_id=v_uid;
  return jsonb_build_object('is_admin',jsonb_array_length(v_roles)>0,'roles',v_roles,'permissions',v_permissions);
end $$;

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
    'casino_net_24h',(select coalesce(sum(net),0) from public.casino_bets where settled_at>now()-interval '24 hours'),
    'open_moderation_actions',(select count(*) from public.admin_moderation_actions where status='active' and (expires_at is null or expires_at>now())),
    'admin_actions_24h',(select count(*) from public.admin_audit_logs where created_at>now()-interval '24 hours'),
    'active_chess_lobbies',(select count(*) from public.game_lobbies where status in ('waiting','active'))
  ) into v_result;
  return v_result;
end $$;

create or replace function public.admin_get_players(p_search text default null,p_limit integer default 25,p_offset integer default 0)
returns table(user_id uuid,username text,display_name text,avatar_url text,balance bigint,xp bigint,level integer,
  created_at timestamptz,last_sign_in_at timestamptz,banned_until timestamptz,email text,role_names text[])
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_search text:=nullif(trim(p_search),'');
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('players.view') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(coalesce(v_search,''))>80 then raise exception 'search is too long'; end if;
  return query
  select p.id,p.username,p.display_name,p.avatar_url,coalesce(w.balance,0),coalesce(w.xp,0),coalesce(w.level,1),
    p.created_at,u.last_sign_in_at,u.banned_until,
    case when private.admin_has_permission('players.email.view') then u.email else null end::text,
    coalesce((select array_agg(r.name order by r.name) from public.admin_user_roles ur join public.admin_roles r on r.id=ur.role_id where ur.user_id=p.id),'{}'::text[])
  from public.profiles p join auth.users u on u.id=p.id left join public.wallets w on w.user_id=p.id
  where v_search is null or p.username ilike '%'||v_search||'%' or coalesce(p.display_name,'') ilike '%'||v_search||'%'
  order by p.created_at desc limit greatest(1,least(coalesce(p_limit,25),100)) offset greatest(0,coalesce(p_offset,0));
end $$;

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
    'slot_spins',(select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]'::jsonb) from (select id,stake,symbols,payout,net,created_at from public.casino_slot_spins where user_id=p_user_id order by created_at desc limit 20) s)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.admin_get_economy_overview()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('economy.view') then raise exception 'permission denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'total_balance',(select coalesce(sum(balance),0) from public.wallets),
    'total_xp',(select coalesce(sum(xp),0) from public.wallets),
    'wallets',(select count(*) from public.wallets),
    'transactions_24h',(select count(*) from public.transactions where created_at>now()-interval '24 hours'),
    'coin_in_24h',(select coalesce(sum(amount),0) from public.transactions where amount>0 and created_at>now()-interval '24 hours'),
    'coin_out_24h',(select coalesce(-sum(amount),0) from public.transactions where amount<0 and created_at>now()-interval '24 hours')
  );
end $$;

create or replace function public.admin_get_casino_overview()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('casino.view') then raise exception 'permission denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'active_tables',(select count(*) from public.casino_tables where status<>'closed'),
    'active_rounds',(select count(*) from public.casino_rounds where status='betting'),
    'table_bets',(select count(*) from public.casino_bets),
    'table_wagered',(select coalesce(sum(stake),0) from public.casino_bets),
    'table_payouts',(select coalesce(sum(payout),0) from public.casino_bets),
    'table_net',(select coalesce(sum(net),0) from public.casino_bets where status in ('won','lost')),
    'slot_spins',(select count(*) from public.casino_slot_spins),
    'slot_wagered',(select coalesce(sum(stake),0) from public.casino_slot_spins),
    'slot_payouts',(select coalesce(sum(payout),0) from public.casino_slot_spins),
    'slot_net',(select coalesce(sum(net),0) from public.casino_slot_spins),
    'player_challenges',(select count(*) from public.casino_challenges where status='settled'),
    'bets_24h',(select count(*) from public.casino_bets where created_at>now()-interval '24 hours'),
    'slots_24h',(select count(*) from public.casino_slot_spins where created_at>now()-interval '24 hours')
  );
end $$;

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
    order by created_at desc limit greatest(1,least(coalesce(p_limit,30),100))
  ) x);
end $$;

revoke all on function public.admin_get_my_access() from public,anon,authenticated;
revoke all on function public.admin_get_overview() from public,anon,authenticated;
revoke all on function public.admin_get_players(text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_get_player_detail(uuid) from public,anon,authenticated;
revoke all on function public.admin_get_economy_overview() from public,anon,authenticated;
revoke all on function public.admin_get_casino_overview() from public,anon,authenticated;
revoke all on function public.admin_get_recent_casino_activity(integer) from public,anon,authenticated;
grant execute on function public.admin_get_my_access() to authenticated;
grant execute on function public.admin_get_overview() to authenticated;
grant execute on function public.admin_get_players(text,integer,integer) to authenticated;
grant execute on function public.admin_get_player_detail(uuid) to authenticated;
grant execute on function public.admin_get_economy_overview() to authenticated;
grant execute on function public.admin_get_casino_overview() to authenticated;
grant execute on function public.admin_get_recent_casino_activity(integer) to authenticated;
