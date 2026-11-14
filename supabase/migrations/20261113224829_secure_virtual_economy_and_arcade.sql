-- Secure the economy RPC surface before exposing wallet actions to the client.
revoke all on function public.internal_adjust(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.do_work() from public, anon, authenticated;

create or replace function public.do_work()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_pay bigint;
  v_available timestamptz;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  insert into public.cooldowns (user_id, action, available_at)
  values (v_uid, 'work', now() + interval '1 hour')
  on conflict (user_id, action) do update
    set available_at = excluded.available_at
    where public.cooldowns.available_at <= now()
  returning available_at into v_available;

  if v_available is null then
    raise exception 'work is on cooldown' using errcode = 'P0001';
  end if;

  v_pay := 100 + floor(random() * 151)::bigint;
  perform public.internal_adjust(v_uid, v_pay, 'work');
  return v_pay;
end;
$$;

create or replace function public.play_arcade_game(p_game text, p_bet bigint, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint;
  v_roll integer;
  v_won boolean := false;
  v_net bigint;
  v_outcome text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_bet is null or p_bet < 1 or p_bet > 5000 then raise exception 'bet must be between 1 and 5000 coins' using errcode = '22023'; end if;

  select balance into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance is null then raise exception 'wallet not found' using errcode = 'P0001'; end if;
  if v_balance < p_bet then raise exception 'not enough coins' using errcode = 'P0001'; end if;

  if p_game = 'coinflip' then
    if p_choice not in ('heads', 'tails') then raise exception 'choose heads or tails' using errcode = '22023'; end if;
    v_outcome := case when random() < 0.5 then 'heads' else 'tails' end;
    v_won := p_choice = v_outcome;
  elsif p_game = 'dice' then
    if p_choice not in ('low', 'high') then raise exception 'choose low or high' using errcode = '22023'; end if;
    v_roll := 1 + floor(random() * 6)::integer;
    v_outcome := v_roll::text;
    v_won := (p_choice = 'low' and v_roll <= 3) or (p_choice = 'high' and v_roll >= 4);
  elsif p_game = 'roulette' then
    if p_choice not in ('red', 'black') then raise exception 'choose red or black' using errcode = '22023'; end if;
    v_roll := floor(random() * 37)::integer;
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
  v_balance := public.internal_adjust(v_uid, v_net, 'arcade:' || p_game || ':' || case when v_won then 'win' else 'loss' end);
  return jsonb_build_object('game', p_game, 'bet', p_bet, 'choice', p_choice, 'outcome', v_outcome, 'won', v_won, 'net', v_net, 'balance', v_balance);
end;
$$;

create or replace function public.buy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_price bigint;
  v_name text;
  v_balance bigint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select buy_price, name into v_price, v_name from public.items where id = p_item_id for share;
  if not found or v_price is null then raise exception 'item is not for sale' using errcode = 'P0001'; end if;
  select balance into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance is null or v_balance < v_price then raise exception 'not enough coins' using errcode = 'P0001'; end if;
  v_balance := public.internal_adjust(v_uid, -v_price, 'shop:buy:' || p_item_id);
  insert into public.inventory (user_id, item_id, qty) values (v_uid, p_item_id, 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
  return jsonb_build_object('item_id', p_item_id, 'name', v_name, 'balance', v_balance);
end;
$$;

create or replace function public.sell_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_price bigint;
  v_name text;
  v_qty integer;
  v_balance bigint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select sell_price, name into v_price, v_name from public.items where id = p_item_id for share;
  if not found or v_price is null then raise exception 'item cannot be sold' using errcode = 'P0001'; end if;
  update public.inventory set qty = qty - 1
  where user_id = v_uid and item_id = p_item_id and qty > 0 returning qty into v_qty;
  if v_qty is null then raise exception 'you do not own this item' using errcode = 'P0001'; end if;
  if v_qty = 0 then delete from public.inventory where user_id = v_uid and item_id = p_item_id; end if;
  v_balance := public.internal_adjust(v_uid, v_price, 'shop:sell:' || p_item_id);
  return jsonb_build_object('item_id', p_item_id, 'name', v_name, 'balance', v_balance);
end;
$$;

revoke all on function public.play_arcade_game(text, bigint, text) from public, anon, authenticated;
revoke all on function public.buy_item(text) from public, anon, authenticated;
revoke all on function public.sell_item(text) from public, anon, authenticated;
grant execute on function public.do_work() to authenticated;
grant execute on function public.play_arcade_game(text, bigint, text) to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.sell_item(text) to authenticated;
