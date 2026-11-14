create or replace function public.admin_get_security_overview()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('security.view') then raise exception 'permission denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'banned_accounts',(select count(*) from auth.users where banned_until>now()),
    'active_mutes',(select count(*) from public.admin_moderation_actions where action_type='mute' and status='active' and expires_at>now()),
    'admin_accounts',(select count(distinct user_id) from public.admin_user_roles),
    'custom_roles',(select count(*) from public.admin_roles where is_system=false),
    'audit_actions_24h',(select count(*) from public.admin_audit_logs where created_at>now()-interval '24 hours'),
    'recent_restrictions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (
      select m.id,m.target_user_id,p.username as target_username,m.actor_id,a.username as actor_username,
        m.action_type,m.reason,m.status,m.created_at,m.expires_at
      from public.admin_moderation_actions m
      left join public.profiles p on p.id=m.target_user_id
      left join public.profiles a on a.id=m.actor_id
      where m.action_type in ('mute','suspend','ban')
      order by m.created_at desc limit 20
    ) x)
  );
end $$;
revoke all on function public.admin_get_security_overview() from public,anon,authenticated;
grant execute on function public.admin_get_security_overview() to authenticated;
