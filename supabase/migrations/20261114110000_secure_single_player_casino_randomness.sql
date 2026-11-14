-- Use cryptographically secure, unbiased outcomes for the single-player casino games.
-- Keep the RPC contract and net-wallet accounting unchanged.
create or replace function public.play_arcade_game(p_game text, p_bet bigint, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint;
  v_byte integer;
  v_roll integer;
  v_won boolean := false;
  v_net bigint;
  v_outcome text;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_bet is null or p_bet < 1 or p_bet > 5000 then
    raise exception 'bet must be between 1 and 5000 coins' using errcode = '22023';
  end if;

  select balance into v_balance
  from public.wallets
  where user_id = v_uid
  for update;

  if v_balance is null then raise exception 'wallet not found' using errcode = 'P0001'; end if;
  if v_balance < p_bet then raise exception 'not enough coins' using errcode = 'P0001'; end if;

  if p_game = 'coinflip' then
    if p_choice is null or p_choice not in ('heads', 'tails') then
      raise exception 'choose heads or tails' using errcode = '22023';
    end if;
    -- 128 accepted byte values map evenly to the two sides.
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < 128;
    end loop;
    v_outcome := case when v_byte < 64 then 'heads' else 'tails' end;
    v_won := p_choice = v_outcome;
  elsif p_game = 'dice' then
    if p_choice is null or p_choice not in ('low', 'high') then
      raise exception 'choose low or high' using errcode = '22023';
    end if;
    -- 252 accepted byte values divide evenly into six outcomes.
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < 252;
    end loop;
    v_roll := 1 + (v_byte % 6);
    v_outcome := v_roll::text;
    v_won := (p_choice = 'low' and v_roll between 1 and 3)
      or (p_choice = 'high' and v_roll between 4 and 6);
  elsif p_game = 'roulette' then
    if p_choice is null or p_choice not in ('red', 'black') then
      raise exception 'choose red or black' using errcode = '22023';
    end if;
    -- 222 accepted byte values divide evenly into 37 pockets.
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < 222;
    end loop;
    v_roll := v_byte % 37;
    v_outcome := v_roll::text || case
      when v_roll = 0 then ' · green'
      when v_roll in (1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36) then ' · red'
      else ' · black'
    end;
    v_won := (p_choice = 'red' and v_roll in (1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36))
      or (p_choice = 'black' and v_roll in (2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35));
  else
    raise exception 'unsupported arcade game' using errcode = '22023';
  end if;

  v_net := case when v_won then p_bet else -p_bet end;
  v_balance := public.internal_adjust(
    v_uid,
    v_net,
    'arcade:' || p_game || ':' || case when v_won then 'win' else 'loss' end
  );

  return jsonb_build_object(
    'game', p_game,
    'bet', p_bet,
    'choice', p_choice,
    'outcome', v_outcome,
    'won', v_won,
    'net', v_net,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.play_arcade_game(text, bigint, text) from public, anon, authenticated;
grant execute on function public.play_arcade_game(text, bigint, text) to authenticated;
