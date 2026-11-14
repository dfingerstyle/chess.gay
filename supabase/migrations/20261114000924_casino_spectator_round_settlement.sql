-- Any room member, including spectators, may trigger settlement after betting closes.
create or replace function public.settle_casino_round(p_round_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_round public.casino_rounds%rowtype; v_byte integer;
  v_roll integer; v_result text; v_colour text; v_bet public.casino_bets%rowtype;
  v_won boolean; v_multiplier integer; v_payout bigint; v_net bigint;
  v_wins integer:=0; v_losses integer:=0; v_total integer:=0;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_round from public.casino_rounds where id=p_round_id for update;
  if not found then raise exception 'round not found'; end if;
  if not exists(select 1 from public.casino_table_members where table_id=v_round.table_id and user_id=v_uid)
    then raise exception 'only table members can settle this round' using errcode='42501'; end if;
  if v_round.status='settled' then return jsonb_build_object('round_id',p_round_id,'status','settled','outcome',v_round.outcome,'already_settled',true); end if;
  if v_round.status='cancelled' then return jsonb_build_object('round_id',p_round_id,'status','cancelled'); end if;
  if now()<v_round.betting_ends_at then raise exception 'betting window is still open'; end if;
  if not exists(select 1 from public.casino_bets where round_id=p_round_id and status='pending') then
    update public.casino_rounds set status='cancelled',settled_at=now() where id=p_round_id;
    return jsonb_build_object('round_id',p_round_id,'status','cancelled','reason','no bets');
  end if;
  if v_round.game_type='roulette' then
    loop v_byte:=get_byte(extensions.gen_random_bytes(1),0); exit when v_byte<222; end loop;
    v_roll:=v_byte%37;
    v_colour:=case when v_roll=0 then 'green' when v_roll in (1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36) then 'red' else 'black' end;
    v_result:=v_roll::text;
  elsif v_round.game_type='dice' then
    loop v_byte:=get_byte(extensions.gen_random_bytes(1),0); exit when v_byte<252; end loop;
    v_roll:=1+(v_byte%6); v_result:=v_roll::text; v_colour:=null;
  else
    v_byte:=get_byte(extensions.gen_random_bytes(1),0); v_result:=case when v_byte<128 then 'heads' else 'tails' end;
    v_roll:=null; v_colour:=null;
  end if;
  for v_bet in select * from public.casino_bets where round_id=p_round_id and status='pending' order by user_id,created_at,id for update loop
    v_won:=false; v_multiplier:=1;
    if v_round.game_type='coinflip' then v_won:=v_bet.choice=v_result;
    elsif v_round.game_type='dice' then v_won:=(v_bet.choice='low' and v_roll between 1 and 3) or (v_bet.choice='high' and v_roll between 4 and 6);
    else
      if v_bet.bet_type='colour' then v_won:=v_bet.choice=v_colour and v_roll<>0;
      elsif v_bet.bet_type='parity' then v_won:=v_roll<>0 and ((v_bet.choice='odd' and v_roll%2=1) or (v_bet.choice='even' and v_roll%2=0));
      elsif v_bet.bet_type='range' then v_won:=(v_bet.choice='low' and v_roll between 1 and 18) or (v_bet.choice='high' and v_roll between 19 and 36);
      elsif v_bet.bet_type='dozen' then v_won:=(v_bet.choice='dozen1' and v_roll between 1 and 12) or (v_bet.choice='dozen2' and v_roll between 13 and 24) or (v_bet.choice='dozen3' and v_roll between 25 and 36); v_multiplier:=2;
      elsif v_bet.bet_type='column' then v_won:=v_roll<>0 and ((v_bet.choice='column1' and v_roll%3=1) or (v_bet.choice='column2' and v_roll%3=2) or (v_bet.choice='column3' and v_roll%3=0)); v_multiplier:=2;
      elsif v_bet.bet_type='number' then v_won:=v_roll=split_part(v_bet.choice,'_',2)::integer; v_multiplier:=35;
      end if;
    end if;
    v_payout:=case when v_won then v_bet.stake*(v_multiplier+1) else 0 end;
    v_net:=case when v_won then v_bet.stake*v_multiplier else -v_bet.stake end;
    if v_won then perform public.internal_adjust(v_bet.user_id,v_payout,'casino:payout:'||p_round_id::text); v_wins:=v_wins+1;
    else v_losses:=v_losses+1; end if;
    v_total:=v_total+1;
    update public.casino_bets set status=case when v_won then 'won' else 'lost' end,payout=v_payout,net=v_net,settled_at=now() where id=v_bet.id;
  end loop;
  update public.casino_rounds set status='settled',
    outcome=case when v_round.game_type='roulette' then jsonb_build_object('number',v_roll,'colour',v_colour,'label',v_result||' · '||v_colour)
      when v_round.game_type='dice' then jsonb_build_object('number',v_roll,'label',v_result)
      else jsonb_build_object('side',v_result,'label',v_result) end,
    settled_at=now() where id=p_round_id returning * into v_round;
  return jsonb_build_object('round_id',p_round_id,'status','settled','outcome',v_round.outcome,'bets_settled',v_total,'wins',v_wins,'losses',v_losses);
end $$;
revoke all on function public.settle_casino_round(uuid) from public,anon,authenticated;
grant execute on function public.settle_casino_round(uuid) to authenticated;
