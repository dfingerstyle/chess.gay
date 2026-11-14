create table public.game_lobbies (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  host_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('standard','four_player')),
  team_mode text not null check (team_mode in ('ffa','2v2')),
  time_control text not null check (time_control in ('1+0','3+0','3+2','5+0','10+0','15+10','30+0')),
  status text not null default 'waiting' check (status in ('waiting','started','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mode = 'four_player' or team_mode = 'ffa')
);
create index game_lobbies_host_id_idx on public.game_lobbies(host_id);
create table public.lobby_members (
  lobby_id uuid not null references public.game_lobbies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat smallint not null check (seat between 1 and 4),
  team smallint check (team in (1,2)),
  joined_at timestamptz not null default now(),
  primary key (lobby_id,user_id),
  unique (lobby_id,seat)
);
create index lobby_members_user_id_idx on public.lobby_members(user_id);
alter table public.game_lobbies enable row level security;
alter table public.lobby_members enable row level security;
create policy "Lobby members can read their lobby"
  on public.game_lobbies for select to authenticated
  using (exists (select 1 from public.lobby_members m where m.lobby_id = game_lobbies.id and m.user_id = (select auth.uid())));
create policy "Players in a lobby can see its seats"
  on public.lobby_members for select to authenticated
  using (exists (select 1 from public.lobby_members viewer where viewer.lobby_id = lobby_members.lobby_id and viewer.user_id = (select auth.uid())));
grant select on public.game_lobbies, public.lobby_members to authenticated;
alter publication supabase_realtime add table public.game_lobbies;
alter publication supabase_realtime add table public.lobby_members;

create or replace function public.create_private_lobby(p_mode text default 'standard',p_team_mode text default 'ffa',p_time_control text default '10+0')
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_raw text; v_code text; v_hash text; v_lobby_id uuid; v_team smallint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_mode not in ('standard','four_player') then raise exception 'unsupported game mode' using errcode = '22023'; end if;
  if p_team_mode not in ('ffa','2v2') or (p_mode='standard' and p_team_mode<>'ffa') then raise exception 'invalid team mode for this game' using errcode = '22023'; end if;
  if p_time_control not in ('1+0','3+0','3+2','5+0','10+0','15+10','30+0') then raise exception 'unsupported time control' using errcode = '22023'; end if;
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

create or replace function public.join_private_lobby(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_code text; v_lobby public.game_lobbies%rowtype; v_seat smallint; v_max smallint; v_available timestamptz; v_team smallint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  v_code := upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));
  if length(v_code)<>16 then raise exception 'enter the full 16-character lobby code' using errcode = '22023'; end if;
  insert into public.cooldowns(user_id,action,available_at) values(v_uid,'lobby_join',now()+interval '2 seconds')
  on conflict(user_id,action) do update set available_at=excluded.available_at
  where public.cooldowns.available_at<=now() returning available_at into v_available;
  if v_available is null then raise exception 'please wait before trying another lobby code' using errcode = 'P0001'; end if;
  select * into v_lobby from public.game_lobbies where code_hash=md5(v_code) for update;
  if not found then raise exception 'lobby code not found' using errcode = 'P0001'; end if;
  if v_lobby.status<>'waiting' then raise exception 'this lobby is no longer accepting players' using errcode = 'P0001'; end if;
  if exists(select 1 from public.lobby_members where lobby_id=v_lobby.id and user_id=v_uid) then
    select seat into v_seat from public.lobby_members where lobby_id=v_lobby.id and user_id=v_uid;
    return jsonb_build_object('lobby_id',v_lobby.id,'seat',v_seat,'mode',v_lobby.mode,'team_mode',v_lobby.team_mode,'time_control',v_lobby.time_control);
  end if;
  v_max := case when v_lobby.mode='standard' then 2 else 4 end;
  select candidate::smallint into v_seat from generate_series(1,v_max) candidate
  where not exists(select 1 from public.lobby_members m where m.lobby_id=v_lobby.id and m.seat=candidate)
  order by candidate limit 1;
  if v_seat is null then raise exception 'this lobby is full' using errcode = 'P0001'; end if;
  v_team := case when v_lobby.team_mode='2v2' then case when v_seat in (1,3) then 1 else 2 end else null end;
  insert into public.lobby_members(lobby_id,user_id,seat,team) values(v_lobby.id,v_uid,v_seat,v_team);
  return jsonb_build_object('lobby_id',v_lobby.id,'seat',v_seat,'mode',v_lobby.mode,'team_mode',v_lobby.team_mode,'time_control',v_lobby.time_control);
end;
$function$;

create or replace function public.leave_private_lobby(p_lobby_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_host uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select host_id into v_host from public.game_lobbies where id=p_lobby_id for update;
  if v_host is null then raise exception 'lobby not found' using errcode = 'P0001'; end if;
  if not exists(select 1 from public.lobby_members where lobby_id=p_lobby_id and user_id=v_uid) then raise exception 'you are not in this lobby' using errcode = '42501'; end if;
  if v_host=v_uid then
    update public.game_lobbies set status='closed',updated_at=now() where id=p_lobby_id;
    return jsonb_build_object('closed',true);
  end if;
  delete from public.lobby_members where lobby_id=p_lobby_id and user_id=v_uid;
  return jsonb_build_object('closed',false);
end;
$function$;

revoke all on function public.create_private_lobby(text,text,text) from public,anon,authenticated;
revoke all on function public.join_private_lobby(text) from public,anon,authenticated;
revoke all on function public.leave_private_lobby(uuid) from public,anon,authenticated;
grant execute on function public.create_private_lobby(text,text,text) to authenticated;
grant execute on function public.join_private_lobby(text) to authenticated;
grant execute on function public.leave_private_lobby(uuid) to authenticated;