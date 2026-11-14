-- Increase private casino room codes to 64 bits of entropy.
create or replace function public.create_casino_table(
  p_name text,p_game_type text,p_visibility text,
  p_max_players smallint default 8,p_min_bet bigint default 1,p_max_bet bigint default 5000
)
returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_code text; v_hash text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_name is null or char_length(trim(p_name)) not between 3 and 32 then raise exception 'table name must be 3–32 characters' using errcode='22023'; end if;
  if p_game_type not in ('roulette','coinflip','dice') then raise exception 'unsupported casino game' using errcode='22023'; end if;
  if p_visibility not in ('public','private') then raise exception 'visibility must be public or private' using errcode='22023'; end if;
  if p_max_players not between 2 and 8 then raise exception 'table capacity must be 2–8 players' using errcode='22023'; end if;
  if p_min_bet not between 1 and 5000 or p_max_bet not between p_min_bet and 5000 then raise exception 'invalid table betting limits' using errcode='22023'; end if;
  if not exists(select 1 from public.wallets where user_id=v_uid) then raise exception 'wallet not found'; end if;
  if p_visibility='private' then
    v_code:=upper(encode(extensions.gen_random_bytes(8),'hex'));
    v_hash:=encode(extensions.digest(v_code,'sha256'),'hex');
  end if;
  insert into public.casino_tables(name,game_type,visibility,code_hash,host_id,max_players,min_bet,max_bet)
  values(trim(p_name),p_game_type,p_visibility,v_hash,v_uid,p_max_players,p_min_bet,p_max_bet) returning id into v_id;
  insert into public.casino_table_members(table_id,user_id,seat,role) values(v_id,v_uid,1,'player');
  return jsonb_build_object('table_id',v_id,'invite_code',v_code,'name',trim(p_name),'game_type',p_game_type,
    'visibility',p_visibility,'max_players',p_max_players,'min_bet',p_min_bet,'max_bet',p_max_bet);
end $$;
revoke all on function public.create_casino_table(text,text,text,smallint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.create_casino_table(text,text,text,smallint,bigint,bigint) to authenticated;
