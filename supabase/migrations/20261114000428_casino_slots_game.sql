-- Three-reel slots with unbiased server-side symbols, fixed paytable and personal history.
create table public.casino_slot_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stake bigint not null check (stake between 1 and 5000),
  symbols text[] not null check (cardinality(symbols)=3),
  payout bigint not null default 0 check (payout>=0),
  net bigint not null,
  created_at timestamptz not null default now()
);
create index casino_slot_spins_user_created_idx on public.casino_slot_spins(user_id,created_at desc);
alter table public.casino_slot_spins enable row level security;
create policy "Players can view their own slot history" on public.casino_slot_spins
for select to authenticated using (user_id=(select auth.uid()));
grant select on public.casino_slot_spins to authenticated;
revoke insert,update,delete on public.casino_slot_spins from anon,authenticated;

create or replace function public.play_casino_slots(p_bet bigint)
returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_balance bigint; v_spin_id uuid:=gen_random_uuid();
  v_byte integer; v_index integer; v_symbols text[]:=array['🍒','🍋','🔔','💎','⭐','7️⃣'];
  v_result text[]:=array[]::text[]; v_multiplier integer:=0; v_payout bigint:=0; v_net bigint; v_i integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_bet is null or p_bet<1 or p_bet>5000 then raise exception 'bet must be between 1 and 5,000 coins' using errcode='22023'; end if;
  select balance into v_balance from public.wallets where user_id=v_uid for update;
  if v_balance is null or v_balance<p_bet then raise exception 'not enough coins'; end if;
  perform public.internal_adjust(v_uid,-p_bet,'casino:slots:stake:'||v_spin_id::text);
  for v_i in 1..3 loop
    loop v_byte:=get_byte(extensions.gen_random_bytes(1),0); exit when v_byte<252; end loop;
    v_index:=1+(v_byte%6);
    v_result:=array_append(v_result,v_symbols[v_index]);
  end loop;
  if v_result[1]=v_result[2] and v_result[2]=v_result[3] then
    v_multiplier:=case v_result[1] when '🍒' then 10 when '🍋' then 12 when '🔔' then 15
      when '💎' then 20 when '⭐' then 40 when '7️⃣' then 110 else 0 end;
  end if;
  v_payout:=p_bet*v_multiplier;
  v_net:=v_payout-p_bet;
  if v_payout>0 then perform public.internal_adjust(v_uid,v_payout,'casino:slots:payout:'||v_spin_id::text); end if;
  insert into public.casino_slot_spins(id,user_id,stake,symbols,payout,net)
  values(v_spin_id,v_uid,p_bet,v_result,v_payout,v_net);
  select balance into v_balance from public.wallets where user_id=v_uid;
  return jsonb_build_object('spin_id',v_spin_id,'game','slots','bet',p_bet,'symbols',to_jsonb(v_result),
    'outcome',array_to_string(v_result,' · '),'won',v_payout>0,'net',v_net,'payout',v_payout,
    'payout_multiplier',v_multiplier,'win_probability','6/216 · 2.78%','rtp','95.83%',
    'house_edge','4.17%','balance',v_balance);
end $$;
revoke all on function public.play_casino_slots(bigint) from public,anon,authenticated;
grant execute on function public.play_casino_slots(bigint) to authenticated;
