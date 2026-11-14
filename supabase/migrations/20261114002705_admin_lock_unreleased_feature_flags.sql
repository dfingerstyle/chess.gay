create or replace function public.admin_update_feature_flag(p_key text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('settings.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if p_enabled and p_key in ('chess_online_enabled','four_player_chess_enabled','tournaments_enabled') then
    raise exception 'this feature is not released yet and cannot be enabled';
  end if;
  update public.admin_feature_flags set enabled=p_enabled,updated_by=v_actor,updated_at=now() where flag_key=p_key;
  if not found then raise exception 'feature flag not found'; end if;
  perform private.admin_log_action('feature_flag.update','feature_flag',p_key,'Updated feature flag',jsonb_build_object('enabled',p_enabled));
  return jsonb_build_object('flag_key',p_key,'enabled',p_enabled);
end $$;
revoke all on function public.admin_update_feature_flag(text,boolean) from public,anon,authenticated;
grant execute on function public.admin_update_feature_flag(text,boolean) to authenticated;
