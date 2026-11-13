create or replace function public.create_private_lobby(
  p_mode text default 'standard',
  p_team_mode text default 'ffa',
  p_time_control text default '10+0'
)
returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_raw text;
  v_code text;
  v_hash text;
  v_lobby_id uuid;
  v_team smallint;
  v_available timestamptz;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_mode not in ('standard','four_player') then raise exception 'unsupported game mode' using errcode = '22023'; end if;
  if p_team_mode not in ('ffa','2v2') or (p_mode='standard' and p_team_mode<>'ffa') then raise exception 'invalid team mode for this game' using errcode = '22023'; end if;
  if p_time_control not in ('1+0','3+0','3+2','5+0','10+0','15+10','30+0') then raise exception 'unsupported time control' using errcode = '22023'; end if;
  insert into public.cooldowns(user_id,action,available_at) values(v_uid,'lobby_create',now()+interval '10 seconds')
  on conflict(user_id,action) do update set available_at=excluded.available_at
  where public.cooldowns.available_at<=now() returning available_at into v_available;
  if v_available is null then raise exception 'please wait before creating another lobby' using errcode = 'P0001'; end if;
  loop
    v_raw := upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    v_code := substr(v_raw,1,4)||'-'||substr(v_raw,5,4)||'-'||substr(v_raw,9,4)||'-'||substr(v_raw,13,4);
    v_hash := md5(v_raw);
    exit when not exists(select 1 from public.game_lobbies where code_hash=v_hash);
  end loop;
  insert into public.game_lobbies(code_hash,host_id,mode,team_mode,time_control) values(v_hash,v_uid,p_mode,p_team_mode,p_time_control) returning id into v_lobby_id;
  v_team := case when p_team_mode='2v2' then 1 else null end;
  insert into public.lobby_members(lobby_id,user_id,seat,team) values(v_lobby_id,v_uid,1,v_team);
  return jsonb_build_object('lobby_id',v_lobby_id,'code',v_code,'mode',p_mode,'team_mode',p_team_mode,'time_control',p_time_control);
end;
$function$;