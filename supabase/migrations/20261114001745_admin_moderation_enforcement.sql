create or replace function public.internal_adjust(p_user uuid,p_amount bigint,p_reason text)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare new_bal bigint;
begin
  if p_user=(select auth.uid()) and exists(select 1 from auth.users where id=p_user and banned_until>now()) then
    raise exception 'account is suspended or banned' using errcode='42501';
  end if;
  update public.wallets set balance=balance+p_amount,updated_at=now() where user_id=p_user returning balance into new_bal;
  if new_bal is null then raise exception 'wallet not found'; end if;
  insert into public.transactions(user_id,amount,reason) values(p_user,p_amount,p_reason);
  return new_bal;
end;
$$;
revoke all on function public.internal_adjust(uuid,bigint,text) from public,anon;
grant execute on function public.internal_adjust(uuid,bigint,text) to authenticated;

create or replace function public.send_casino_message(p_table_id uuid,p_message text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id bigint; v_mute_until timestamptz;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_message is null or char_length(trim(p_message)) not between 1 and 500 then raise exception 'message must be 1–500 characters' using errcode='22023'; end if;
  if exists(select 1 from public.admin_moderation_actions where target_user_id=v_uid and action_type='mute' and status='active' and (expires_at is null or expires_at>now())) then
    select max(expires_at) into v_mute_until from public.admin_moderation_actions where target_user_id=v_uid and action_type='mute' and status='active' and (expires_at is null or expires_at>now());
    raise exception 'chat is muted until %',coalesce(v_mute_until::text,'further notice') using errcode='42501';
  end if;
  if not exists(select 1 from public.casino_table_members where table_id=p_table_id and user_id=v_uid) then raise exception 'join the table before chatting' using errcode='42501'; end if;
  insert into public.casino_chat_messages(table_id,user_id,message) values(p_table_id,v_uid,trim(p_message)) returning id into v_id;
  return jsonb_build_object('message_id',v_id);
end $$;
revoke all on function public.send_casino_message(uuid,text) from public,anon,authenticated;
grant execute on function public.send_casino_message(uuid,text) to authenticated;

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
    delete from auth.sessions where user_id=p_user_id;
  end if;
  perform private.admin_log_action('moderation.'||p_action,'player',p_user_id::text,trim(p_reason),
    jsonb_build_object('moderation_action_id',v_id,'expires_at',v_expiry));
  return v_id;
end $$;
revoke all on function public.admin_moderate_player(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.admin_moderate_player(uuid,text,text,integer) to authenticated;

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
revoke all on function public.admin_get_my_account_status() from public,anon,authenticated;
grant execute on function public.admin_get_my_account_status() to authenticated;
