create or replace function private.admin_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null
    and not exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.banned_until>now())
    and exists(
      select 1 from public.admin_user_roles ur
      join public.admin_role_permissions rp on rp.role_id=ur.role_id
      where ur.user_id=(select auth.uid()) and rp.permission_key=p_permission
    );
$$;
revoke all on function private.admin_has_permission(text) from public,anon,authenticated,service_role;
grant execute on function private.admin_has_permission(text) to authenticated;

create or replace function public.admin_get_my_account_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_banned_until timestamptz; v_mute_until timestamptz;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select banned_until into v_banned_until from auth.users where id=v_uid;
  select max(expires_at) into v_mute_until from public.admin_moderation_actions
    where target_user_id=v_uid and action_type='mute' and status='active' and (expires_at is null or expires_at>now());
  return jsonb_build_object('is_banned',coalesce(v_banned_until>now(),false),'banned_until',v_banned_until,
    'is_muted',v_mute_until is not null and v_mute_until>now(),'muted_until',v_mute_until);
end $$;
