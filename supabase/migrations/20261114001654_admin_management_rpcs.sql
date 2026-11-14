create table if not exists public.admin_ban_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  original_banned_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.admin_ban_state enable row level security;
revoke all on public.admin_ban_state from public,anon,authenticated;

create or replace function public.admin_adjust_wallet(p_user_id uuid,p_delta bigint,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_balance bigint; v_old bigint;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('economy.adjust') then raise exception 'permission denied' using errcode='42501'; end if;
  if p_user_id is null or p_delta is null or p_delta=0 or abs(p_delta)>10000 then raise exception 'adjustment must be between -10,000 and 10,000 coins'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  select balance into v_old from public.wallets where user_id=p_user_id for update;
  if v_old is null then raise exception 'player wallet not found'; end if;
  if v_old+p_delta<0 then raise exception 'adjustment would make the wallet negative'; end if;
  v_balance:=public.internal_adjust(p_user_id,p_delta,'admin-adjustment:'||v_actor::text||':'||left(trim(p_reason),120));
  perform private.admin_log_action('economy.wallet_adjust','player',p_user_id::text,trim(p_reason),
    jsonb_build_object('delta',p_delta,'previous_balance',v_old,'new_balance',v_balance));
  return jsonb_build_object('user_id',p_user_id,'previous_balance',v_old,'balance',v_balance,'delta',p_delta);
end $$;

create or replace function public.admin_moderate_player(p_user_id uuid,p_action text,p_reason text,p_duration_minutes integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_permission text; v_expiry timestamptz; v_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  v_permission:=case p_action when 'warning' then 'moderation.warn' when 'mute' then 'moderation.mute'
    when 'suspend' then 'moderation.suspend' when 'ban' then 'moderation.ban' else null end;
  if v_permission is null then raise exception 'unsupported moderation action'; end if;
  if not private.admin_has_permission(v_permission) then raise exception 'permission denied' using errcode='42501'; end if;
  if p_user_id is null or p_user_id=v_actor then raise exception 'cannot apply this action to yourself'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'player not found'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  if p_action='warning' then
    if p_duration_minutes is not null then raise exception 'warnings do not have a duration'; end if; v_expiry:=null;
  elsif p_action='mute' then
    if p_duration_minutes is null or p_duration_minutes not between 1 and 10080 then raise exception 'mute duration must be 1–10,080 minutes'; end if;
    v_expiry:=now()+make_interval(mins=>p_duration_minutes);
  elsif p_action='suspend' then
    if p_duration_minutes is null or p_duration_minutes not between 1 and 43200 then raise exception 'suspension duration must be 1–43,200 minutes'; end if;
    v_expiry:=now()+make_interval(mins=>p_duration_minutes);
  else
    if p_duration_minutes is not null and p_duration_minutes not between 1 and 525600 then raise exception 'ban duration must be 1–525,600 minutes or permanent'; end if;
    v_expiry:=case when p_duration_minutes is null then now()+interval '100 years' else now()+make_interval(mins=>p_duration_minutes) end;
  end if;
  insert into public.admin_moderation_actions(target_user_id,actor_id,action_type,reason,expires_at)
  values(p_user_id,v_actor,p_action,trim(p_reason),v_expiry) returning id into v_id;
  if p_action in ('suspend','ban') then
    insert into public.admin_ban_state(user_id,original_banned_until)
    select p_user_id,banned_until from auth.users where id=p_user_id on conflict(user_id) do nothing;
    update auth.users set banned_until=greatest(coalesce(banned_until,'-infinity'::timestamptz),v_expiry) where id=p_user_id;
  end if;
  perform private.admin_log_action('moderation.'||p_action,'player',p_user_id::text,trim(p_reason),
    jsonb_build_object('moderation_action_id',v_id,'expires_at',v_expiry));
  return v_id;
end $$;

create or replace function public.admin_revoke_moderation_action(p_action_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_action public.admin_moderation_actions%rowtype;
  v_active_until timestamptz; v_original timestamptz;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('moderation.revoke') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  select * into v_action from public.admin_moderation_actions where id=p_action_id for update;
  if not found then raise exception 'moderation action not found'; end if;
  if v_action.status<>'active' then raise exception 'moderation action is not active'; end if;
  update public.admin_moderation_actions set status='revoked',revoked_at=now(),revoked_by=v_actor where id=p_action_id;
  if v_action.action_type in ('suspend','ban') then
    select max(expires_at) into v_active_until from public.admin_moderation_actions
      where target_user_id=v_action.target_user_id and action_type in ('suspend','ban') and status='active' and expires_at>now();
    select original_banned_until into v_original from public.admin_ban_state where user_id=v_action.target_user_id;
    if v_active_until is null then
      update auth.users set banned_until=v_original where id=v_action.target_user_id;
      delete from public.admin_ban_state where user_id=v_action.target_user_id;
    else
      update auth.users set banned_until=greatest(coalesce(v_original,'-infinity'::timestamptz),v_active_until) where id=v_action.target_user_id;
    end if;
  end if;
  perform private.admin_log_action('moderation.revoke','player',v_action.target_user_id::text,trim(p_reason),
    jsonb_build_object('moderation_action_id',p_action_id,'original_action',v_action.action_type));
  return jsonb_build_object('status','revoked','target_user_id',v_action.target_user_id);
end $$;

create or replace function public.admin_assign_role(p_user_id uuid,p_role_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_key text; v_name text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('roles.assign') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'player not found'; end if;
  select role_key,name into v_key,v_name from public.admin_roles where id=p_role_id;
  if v_key is null then raise exception 'role not found'; end if;
  if v_key='owner' and p_user_id<>v_actor then raise exception 'the owner role cannot be assigned to another account'; end if;
  insert into public.admin_user_roles(user_id,role_id,granted_by,reason) values(p_user_id,p_role_id,v_actor,trim(p_reason))
  on conflict(user_id,role_id) do nothing;
  perform private.admin_log_action('roles.assign','player',p_user_id::text,trim(p_reason),jsonb_build_object('role_key',v_key,'role_name',v_name));
  return jsonb_build_object('user_id',p_user_id,'role_id',p_role_id,'role_key',v_key,'role_name',v_name);
end $$;

create or replace function public.admin_remove_role(p_user_id uuid,p_role_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_key text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('roles.assign') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  select role_key into v_key from public.admin_roles where id=p_role_id;
  if v_key is null then raise exception 'role not found'; end if;
  if v_key='owner' then raise exception 'the owner role cannot be removed'; end if;
  delete from public.admin_user_roles where user_id=p_user_id and role_id=p_role_id;
  perform private.admin_log_action('roles.remove','player',p_user_id::text,trim(p_reason),jsonb_build_object('role_key',v_key));
  return jsonb_build_object('user_id',p_user_id,'role_id',p_role_id,'removed',true);
end $$;

create or replace function public.admin_create_role(p_key text,p_name text,p_description text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_role public.admin_roles%rowtype;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('roles.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if p_key !~ '^[a-z][a-z0-9_-]{1,31}$' then raise exception 'role key must be a lowercase slug'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 40 then raise exception 'role name must be 2–40 characters'; end if;
  if char_length(coalesce(p_description,''))>300 then raise exception 'description is too long'; end if;
  insert into public.admin_roles(role_key,name,description,is_system) values(p_key,trim(p_name),trim(coalesce(p_description,'')),false) returning * into v_role;
  perform private.admin_log_action('roles.create','role',v_role.id::text,'Created custom role',jsonb_build_object('role_key',v_role.role_key,'name',v_role.name));
  return jsonb_build_object('id',v_role.id,'key',v_role.role_key,'name',v_role.name);
end $$;

create or replace function public.admin_set_role_permissions(p_role_id uuid,p_permissions text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_key text; v_count integer;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('roles.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  select role_key into v_key from public.admin_roles where id=p_role_id for update;
  if v_key is null then raise exception 'role not found'; end if;
  if v_key='owner' then raise exception 'owner permissions are immutable'; end if;
  if coalesce(array_length(p_permissions,1),0)>100 then raise exception 'too many permissions'; end if;
  if exists(select 1 from unnest(coalesce(p_permissions,'{}'::text[])) x where not exists(select 1 from public.admin_permissions p where p.permission_key=x)) then
    raise exception 'one or more permissions are unknown';
  end if;
  delete from public.admin_role_permissions where role_id=p_role_id;
  insert into public.admin_role_permissions(role_id,permission_key)
  select p_role_id,x from (select distinct unnest(coalesce(p_permissions,'{}'::text[])) x) q;
  select count(*) into v_count from public.admin_role_permissions where role_id=p_role_id;
  perform private.admin_log_action('roles.permissions.update','role',p_role_id::text,'Updated custom role permissions',jsonb_build_object('permissions',coalesce(p_permissions,'{}'::text[])));
  return jsonb_build_object('role_id',p_role_id,'permission_count',v_count);
end $$;

create or replace function public.admin_delete_role(p_role_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_role public.admin_roles%rowtype;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('roles.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  select * into v_role from public.admin_roles where id=p_role_id for update;
  if not found then raise exception 'role not found'; end if;
  if v_role.is_system or v_role.role_key='owner' then raise exception 'system roles cannot be deleted'; end if;
  if exists(select 1 from public.admin_user_roles where role_id=p_role_id) then raise exception 'remove this role from all users before deleting it'; end if;
  delete from public.admin_roles where id=p_role_id;
  perform private.admin_log_action('roles.delete','role',p_role_id::text,trim(p_reason),jsonb_build_object('role_key',v_role.role_key,'name',v_role.name));
  return jsonb_build_object('deleted',true,'role_key',v_role.role_key);
end $$;

create or replace function public.admin_add_player_note(p_user_id uuid,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('players.notes') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 2 and 2000 then raise exception 'note must be 2–2,000 characters'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'player not found'; end if;
  insert into public.admin_player_notes(user_id,author_id,note) values(p_user_id,v_actor,trim(p_note)) returning id into v_id;
  perform private.admin_log_action('players.note.add','player',p_user_id::text,'Added internal support note',jsonb_build_object('note_id',v_id));
  return v_id;
end $$;

create or replace function public.admin_update_system_setting(p_key text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('settings.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if not exists(select 1 from public.admin_system_settings where setting_key=p_key) then raise exception 'setting not found'; end if;
  if p_key='maintenance_mode' and jsonb_typeof(p_value)<>'boolean' then raise exception 'maintenance_mode must be boolean'; end if;
  if p_key='maintenance_message' and (jsonb_typeof(p_value)<>'string' or char_length(p_value#>>'{}')>300) then raise exception 'maintenance message must be a string up to 300 characters'; end if;
  update public.admin_system_settings set value=p_value,updated_by=v_actor,updated_at=now() where setting_key=p_key;
  perform private.admin_log_action('settings.update','setting',p_key,'Updated platform setting',jsonb_build_object('value',p_value));
  return jsonb_build_object('setting_key',p_key,'value',p_value);
end $$;

create or replace function public.admin_update_feature_flag(p_key text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('settings.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  update public.admin_feature_flags set enabled=p_enabled,updated_by=v_actor,updated_at=now() where flag_key=p_key;
  if not found then raise exception 'feature flag not found'; end if;
  perform private.admin_log_action('feature_flag.update','feature_flag',p_key,'Updated feature flag',jsonb_build_object('enabled',p_enabled));
  return jsonb_build_object('flag_key',p_key,'enabled',p_enabled);
end $$;

revoke all on function public.admin_adjust_wallet(uuid,bigint,text) from public,anon,authenticated;
revoke all on function public.admin_moderate_player(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.admin_revoke_moderation_action(uuid,text) from public,anon,authenticated;
revoke all on function public.admin_assign_role(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.admin_remove_role(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.admin_create_role(text,text,text) from public,anon,authenticated;
revoke all on function public.admin_set_role_permissions(uuid,text[]) from public,anon,authenticated;
revoke all on function public.admin_delete_role(uuid,text) from public,anon,authenticated;
revoke all on function public.admin_add_player_note(uuid,text) from public,anon,authenticated;
revoke all on function public.admin_update_system_setting(text,jsonb) from public,anon,authenticated;
revoke all on function public.admin_update_feature_flag(text,boolean) from public,anon,authenticated;
grant execute on function public.admin_adjust_wallet(uuid,bigint,text) to authenticated;
grant execute on function public.admin_moderate_player(uuid,text,text,integer) to authenticated;
grant execute on function public.admin_revoke_moderation_action(uuid,text) to authenticated;
grant execute on function public.admin_assign_role(uuid,uuid,text) to authenticated;
grant execute on function public.admin_remove_role(uuid,uuid,text) to authenticated;
grant execute on function public.admin_create_role(text,text,text) to authenticated;
grant execute on function public.admin_set_role_permissions(uuid,text[]) to authenticated;
grant execute on function public.admin_delete_role(uuid,text) to authenticated;
grant execute on function public.admin_add_player_note(uuid,text) to authenticated;
grant execute on function public.admin_update_system_setting(text,jsonb) to authenticated;
grant execute on function public.admin_update_feature_flag(text,boolean) to authenticated;
