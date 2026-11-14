-- Add player-versus-player coinflip, dice and roulette challenges.
alter table public.casino_challenges add column if not exists game_type text not null default 'coinflip';
alter table public.casino_challenges drop constraint if exists casino_challenges_challenger_choice_check;
alter table public.casino_challenges add constraint casino_challenges_choice_by_game_check check (
  (game_type='coinflip' and challenger_choice in ('heads','tails'))
  or (game_type='dice' and challenger_choice in ('low','high'))
  or (game_type='roulette' and challenger_choice in ('red','black'))
);

create or replace function public.create_casino_challenge_v2(p_opponent_id uuid,p_stake bigint,p_game_type text,p_choice text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_opponent_id is null or p_opponent_id=v_uid then raise exception 'choose another player'; end if;
  if p_stake is null or p_stake not between 1 and 5000 then raise exception 'stake must be between 1 and 5,000 coins'; end if;
  if p_game_type not in ('coinflip','dice','roulette') then raise exception 'unsupported challenge game'; end if;
  if (p_game_type='coinflip' and p_choice not in ('heads','tails'))
    or (p_game_type='dice' and p_choice not in ('low','high'))
    or (p_game_type='roulette' and p_choice not in ('red','black')) then raise exception 'invalid challenge choice for selected game'; end if;
  if not exists(select 1 from public.profiles where id=p_opponent_id) then raise exception 'player not found'; end if;
  insert into public.casino_challenges(challenger_id,opponent_id,stake,challenger_choice,game_type)
  values(v_uid,p_opponent_id,p_stake,p_choice,p_game_type) returning id into v_id;
  return v_id;
end $$;

create or replace function public.accept_casino_challenge(p_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_challenge public.casino_challenges%rowtype;
  v_byte integer; v_roll integer; v_outcome text; v_colour text; v_winner uuid; v_balance bigint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_challenge from public.casino_challenges where id=p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  if v_challenge.opponent_id<>v_uid then raise exception 'only the challenged player can accept' using errcode='42501'; end if;
  if v_challenge.status<>'pending' then raise exception 'challenge is no longer pending'; end if;
  if now()>=v_challenge.expires_at then update public.casino_challenges set status='expired' where id=p_challenge_id; return jsonb_build_object('status','expired'); end if;
  perform 1 from public.wallets where user_id in (v_challenge.challenger_id,v_challenge.opponent_id) order by user_id for update;
  select balance into v_balance from public.wallets where user_id=v_challenge.challenger_id;
  if v_balance is null or v_balance<v_challenge.stake then raise exception 'challenger no longer has enough coins'; end if;
  select balance into v_balance from public.wallets where user_id=v_challenge.opponent_id;
  if v_balance is null or v_balance<v_challenge.stake then raise exception 'you do not have enough coins'; end if;
  perform public.internal_adjust(v_challenge.challenger_id,-v_challenge.stake,'casino:challenge:stake:'||p_challenge_id::text);
  perform public.internal_adjust(v_challenge.opponent_id,-v_challenge.stake,'casino:challenge:stake:'||p_challenge_id::text);
  if v_challenge.game_type='coinflip' then
    v_byte:=get_byte(extensions.gen_random_bytes(1),0);
    v_outcome:=case when v_byte<128 then 'heads' else 'tails' end;
    v_winner:=case when v_outcome=v_challenge.challenger_choice then v_challenge.challenger_id else v_challenge.opponent_id end;
  elsif v_challenge.game_type='dice' then
    loop v_byte:=get_byte(extensions.gen_random_bytes(1),0); exit when v_byte<252; end loop;
    v_roll:=1+(v_byte%6); v_outcome:=v_roll::text;
    v_winner:=case when (v_challenge.challenger_choice='low' and v_roll between 1 and 3)
      or (v_challenge.challenger_choice='high' and v_roll between 4 and 6)
      then v_challenge.challenger_id else v_challenge.opponent_id end;
  else
    loop v_byte:=get_byte(extensions.gen_random_bytes(1),0); exit when v_byte<222; end loop;
    v_roll:=v_byte%37;
    v_colour:=case when v_roll=0 then 'green' when v_roll in (1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36) then 'red' else 'black' end;
    v_outcome:=v_roll::text||' · '||v_colour;
    if v_roll=0 then
      perform public.internal_adjust(v_challenge.challenger_id,v_challenge.stake,'casino:challenge:push:'||p_challenge_id::text);
      perform public.internal_adjust(v_challenge.opponent_id,v_challenge.stake,'casino:challenge:push:'||p_challenge_id::text);
      v_winner:=null;
    else v_winner:=case when v_colour=v_challenge.challenger_choice then v_challenge.challenger_id else v_challenge.opponent_id end;
    end if;
  end if;
  if v_winner is not null then perform public.internal_adjust(v_winner,v_challenge.stake*2,'casino:challenge:win:'||p_challenge_id::text); end if;
  update public.casino_challenges set status='settled',outcome=v_outcome,winner_id=v_winner,settled_at=now() where id=p_challenge_id;
  return jsonb_build_object('status','settled','game_type',v_challenge.game_type,'outcome',v_outcome,'winner_id',v_winner,
    'push',v_winner is null,'stake_each',v_challenge.stake,'winner_payout',case when v_winner is null then 0 else v_challenge.stake*2 end);
end $$;

revoke all on function public.create_casino_challenge_v2(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.create_casino_challenge_v2(uuid,bigint,text,text) to authenticated;
revoke all on function public.accept_casino_challenge(uuid) from public,anon,authenticated;
grant execute on function public.accept_casino_challenge(uuid) to authenticated;
