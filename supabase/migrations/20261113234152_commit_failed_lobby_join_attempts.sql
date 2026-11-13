create or replace function public.join_private_lobby(p_code text)
returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid(); v_code text; v_lobby public.game_lobbies%rowtype;
  v_seat smallint; v_max smallint; v_available timestamptz; v_team smallint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  v_code:=upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));
  if length(v_code)<>16 then return jsonb_build_object('error','enter the full 16-character lobby code'); end if;
  insert into public.cooldowns(user_id,action,available_at) values(v_uid,'lobby_join',now()+interval '2 seconds')
  on conflict(user_id,action) do update set available_at=excluded.available_at
  where public.cooldowns.available_at<=now() returning available_at into v_available;
  if v_available is null then return jsonb_build_object('error','please wait before trying another lobby code'); end if;
  select * into v_lobby from public.game_lobbies where code_hash=md5(v_code) for update;
  if not found then return jsonb_build_object('error','lobby code not found'); end if;
  if v_lobby.status<>'waiting' then return jsonb_build_object('error','this lobby is no longer accepting players'); end if;
  if exists(select 1 from public.lobby_members where lobby_id=v_lobby.id and user_id=v_uid) then
    select seat into v_seat from public.lobby_members where lobby_id=v_lobby.id and user_id=v_uid;
    return jsonb_build_object('lobby_id',v_lobby.id,'seat',v_seat,'mode',v_lobby.mode,'team_mode',v_lobby.team_mode,'time_control',v_lobby.time_control);
  end if;
  v_max:=case when v_lobby.mode='standard' then 2 else 4 end;
  select candidate::smallint into v_seat from generate_series(1,v_max) candidate
  where not exists(select 1 from public.lobby_members m where m.lobby_id=v_lobby.id and m.seat=candidate)
  order by candidate limit 1;
  if v_seat is null then return jsonb_build_object('error','this lobby is full'); end if;
  v_team:=case when v_lobby.team_mode='2v2' then case when v_seat in (1,3) then 1 else 2 end else null end;
  insert into public.lobby_members(lobby_id,user_id,seat,team) values(v_lobby.id,v_uid,v_seat,v_team);
  return jsonb_build_object('lobby_id',v_lobby.id,'seat',v_seat,'mode',v_lobby.mode,'team_mode',v_lobby.team_mode,'time_control',v_lobby.time_control);
end;
$function$;