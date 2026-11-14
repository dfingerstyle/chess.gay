-- Multiplayer casino foundation: virtual-coin tables, rounds, escrowed bets,
-- table chat, spectator membership, head-to-head challenges and public statistics.

create table public.casino_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 32),
  game_type text not null check (game_type in ('roulette','coinflip','dice')),
  visibility text not null check (visibility in ('public','private')),
  code_hash text unique,
  host_id uuid not null references public.profiles(id) on delete cascade,
  max_players smallint not null default 8 check (max_players between 2 and 8),
  min_bet bigint not null default 1 check (min_bet between 1 and 5000),
  max_bet bigint not null default 5000 check (max_bet between min_bet and 5000),
  status text not null default 'waiting' check (status in ('waiting','active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((visibility='private' and code_hash is not null) or (visibility='public' and code_hash is null))
);
create table public.casino_table_members (
  table_id uuid not null references public.casino_tables(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat smallint,
  role text not null default 'player' check (role in ('player','spectator')),
  joined_at timestamptz not null default now(),
  primary key(table_id,user_id),
  unique(table_id,seat),
  check ((role='player' and seat between 1 and 8) or (role='spectator' and seat is null))
);
create table public.casino_rounds (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.casino_tables(id) on delete cascade,
  round_number integer not null check (round_number>0),
  game_type text not null check (game_type in ('roulette','coinflip','dice')),
  status text not null default 'betting' check (status in ('betting','settled','cancelled')),
  betting_ends_at timestamptz not null,
  outcome jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(table_id,round_number)
);
create table public.casino_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.casino_rounds(id) on delete cascade,
  table_id uuid not null references public.casino_tables(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  bet_type text not null,
  choice text not null,
  stake bigint not null check (stake between 1 and 5000),
  payout bigint not null default 0 check (payout>=0),
  net bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','won','lost','refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create table public.casino_chat_messages (
  id bigint generated always as identity primary key,
  table_id uuid not null references public.casino_tables(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.casino_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  stake bigint not null check (stake between 1 and 5000),
  challenger_choice text not null check (challenger_choice in ('heads','tails')),
  status text not null default 'pending' check (status in ('pending','settled','declined','cancelled','expired')),
  outcome text check (outcome in ('heads','tails')),
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  settled_at timestamptz,
  check(challenger_id<>opponent_id)
);

create index casino_tables_public_status_idx on public.casino_tables(status,created_at desc) where visibility='public';
create index casino_tables_host_idx on public.casino_tables(host_id);
create index casino_members_user_idx on public.casino_table_members(user_id);
create index casino_rounds_table_idx on public.casino_rounds(table_id,round_number desc);
create index casino_bets_round_idx on public.casino_bets(round_id,status);
create index casino_bets_user_idx on public.casino_bets(user_id,created_at desc);
create index casino_chat_table_idx on public.casino_chat_messages(table_id,id desc);
create index casino_challenges_opponent_idx on public.casino_challenges(opponent_id,status,created_at desc);
create index casino_challenges_challenger_idx on public.casino_challenges(challenger_id,status,created_at desc);

alter table public.casino_tables enable row level security;
alter table public.casino_table_members enable row level security;
alter table public.casino_rounds enable row level security;
alter table public.casino_bets enable row level security;
alter table public.casino_chat_messages enable row level security;
alter table public.casino_challenges enable row level security;

create policy "Casino tables visible to public or members" on public.casino_tables
for select to authenticated using (
  visibility='public' or exists(select 1 from public.casino_table_members m where m.table_id=id and m.user_id=(select auth.uid()))
);
create policy "Casino members visible to table participants" on public.casino_table_members
for select to authenticated using (
  user_id=(select auth.uid()) or exists(
    select 1 from public.casino_tables t where t.id=table_id and
    (t.visibility='public' or exists(select 1 from public.casino_table_members mine where mine.table_id=t.id and mine.user_id=(select auth.uid())))
  )
);
create policy "Casino rounds visible to table participants" on public.casino_rounds
for select to authenticated using (
  exists(select 1 from public.casino_tables t where t.id=table_id and
    (t.visibility='public' or exists(select 1 from public.casino_table_members m where m.table_id=t.id and m.user_id=(select auth.uid())))
  )
);
create policy "Casino bets visible to owner or table participants" on public.casino_bets
for select to authenticated using (
  user_id=(select auth.uid()) or exists(
    select 1 from public.casino_tables t where t.id=table_id and
    (t.visibility='public' or exists(select 1 from public.casino_table_members m where m.table_id=t.id and m.user_id=(select auth.uid())))
  )
);
create policy "Casino chat visible to table participants" on public.casino_chat_messages
for select to authenticated using (
  exists(select 1 from public.casino_table_members m where m.table_id=table_id and m.user_id=(select auth.uid()))
);
create policy "Casino challenges visible to participants" on public.casino_challenges
for select to authenticated using (challenger_id=(select auth.uid()) or opponent_id=(select auth.uid()));

grant select on public.casino_tables,public.casino_table_members,public.casino_rounds,
  public.casino_bets,public.casino_chat_messages,public.casino_challenges to authenticated;
revoke insert,update,delete on public.casino_tables,public.casino_table_members,
  public.casino_rounds,public.casino_bets,public.casino_chat_messages,public.casino_challenges from anon,authenticated;

create or replace function public.create_casino_table(p_name text,p_game_type text,p_visibility text,
  p_max_players smallint default 8,p_min_bet bigint default 1,p_max_bet bigint default 5000)
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
    v_code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    v_hash:=encode(extensions.digest(v_code,'sha256'),'hex');
  end if;
  insert into public.casino_tables(name,game_type,visibility,code_hash,host_id,max_players,min_bet,max_bet)
  values(trim(p_name),p_game_type,p_visibility,v_hash,v_uid,p_max_players,p_min_bet,p_max_bet) returning id into v_id;
  insert into public.casino_table_members(table_id,user_id,seat,role) values(v_id,v_uid,1,'player');
  return jsonb_build_object('table_id',v_id,'invite_code',v_code,'name',trim(p_name),'game_type',p_game_type,
    'visibility',p_visibility,'max_players',p_max_players,'min_bet',p_min_bet,'max_bet',p_max_bet);
end $$;

create or replace function public.join_casino_table(p_table_id uuid,p_role text default 'player',p_code text default null)
returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_table public.casino_tables%rowtype; v_seat smallint; v_count integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_role not in ('player','spectator') then raise exception 'invalid table role' using errcode='22023'; end if;
  select * into v_table from public.casino_tables where id=p_table_id for update;
  if not found or v_table.status='closed' then raise exception 'table is unavailable'; end if;
  if v_table.visibility='private' and (
    p_code is null or v_table.code_hash is distinct from encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex')
  ) and not exists(select 1 from public.casino_table_members where table_id=p_table_id and user_id=v_uid)
  then raise exception 'invalid invite code' using errcode='22023'; end if;
  if exists(select 1 from public.casino_table_members where table_id=p_table_id and user_id=v_uid)
    then return jsonb_build_object('table_id',p_table_id,'joined',true,'already_member',true); end if;
  if p_role='player' then
    if v_table.status<>'waiting' then raise exception 'this table has already started'; end if;
    select count(*) into v_count from public.casino_table_members where table_id=p_table_id and role='player';
    if v_count>=v_table.max_players then raise exception 'table is full'; end if;
    select candidate into v_seat from generate_series(1,v_table.max_players) candidate
    where not exists(select 1 from public.casino_table_members m where m.table_id=p_table_id and m.seat=candidate)
    order by candidate limit 1;
  else
    select count(*) into v_count from public.casino_table_members where table_id=p_table_id and role='spectator';
    if v_count>=50 then raise exception 'spectator limit reached'; end if;
    v_seat:=null;
  end if;
  insert into public.casino_table_members(table_id,user_id,seat,role) values(p_table_id,v_uid,v_seat,p_role);
  return jsonb_build_object('table_id',p_table_id,'joined',true,'role',p_role,'seat',v_seat);
end $$;

create or replace function public.leave_casino_table(p_table_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_host uuid; v_status text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select host_id,status into v_host,v_status from public.casino_tables where id=p_table_id for update;
  if v_host is null then raise exception 'table not found'; end if;
  if exists(select 1 from public.casino_rounds where table_id=p_table_id and status='betting')
    then raise exception 'settle or cancel the open round before leaving'; end if;
  if v_host=v_uid then update public.casino_tables set status='closed',updated_at=now() where id=p_table_id; end if;
  delete from public.casino_table_members where table_id=p_table_id and user_id=v_uid;
  return jsonb_build_object('table_id',p_table_id,'closed',v_host=v_uid,'left',true);
end $$;

create or replace function public.start_casino_round(p_table_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_table public.casino_tables%rowtype; v_round_id uuid; v_number integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_table from public.casino_tables where id=p_table_id for update;
  if not found or v_table.status='closed' then raise exception 'table is unavailable'; end if;
  if v_table.host_id<>v_uid then raise exception 'only the host can start a round' using errcode='42501'; end if;
  if not exists(select 1 from public.casino_table_members where table_id=p_table_id and user_id=v_uid and role='player') then raise exception 'host must be seated to start'; end if;
  if exists(select 1 from public.casino_rounds where table_id=p_table_id and status='betting') then raise exception 'the previous round is still open'; end if;
  select coalesce(max(round_number),0)+1 into v_number from public.casino_rounds where table_id=p_table_id;
  insert into public.casino_rounds(table_id,round_number,game_type,betting_ends_at)
  values(p_table_id,v_number,v_table.game_type,now()+interval '20 seconds') returning id into v_round_id;
  update public.casino_tables set status='active',updated_at=now() where id=p_table_id;
  return jsonb_build_object('round_id',v_round_id,'round_number',v_number,'betting_ends_at',now()+interval '20 seconds');
end $$;

create or replace function public.place_casino_bet(p_round_id uuid,p_bet_type text,p_choice text,p_stake bigint)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_round public.casino_rounds%rowtype; v_table public.casino_tables%rowtype; v_balance bigint; v_bet_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_stake is null or p_stake<1 or p_stake>5000 then raise exception 'stake must be between 1 and 5,000 coins' using errcode='22023'; end if;
  select * into v_round from public.casino_rounds where id=p_round_id for update;
  if not found or v_round.status<>'betting' or now()>=v_round.betting_ends_at then raise exception 'betting is closed'; end if;
  select * into v_table from public.casino_tables where id=v_round.table_id;
  if p_stake<v_table.min_bet or p_stake>v_table.max_bet then raise exception 'stake is outside this table limit'; end if;
  if not exists(select 1 from public.casino_table_members where table_id=v_table.id and user_id=v_uid and role='player') then raise exception 'join the table as a player before betting' using errcode='42501'; end if;
  if v_round.game_type='roulette' then
    if p_bet_type='colour' and p_choice not in ('red','black') then raise exception 'invalid colour bet'; end if;
    if p_bet_type='parity' and p_choice not in ('odd','even') then raise exception 'invalid parity bet'; end if;
    if p_bet_type='range' and p_choice not in ('low','high') then raise exception 'invalid range bet'; end if;
    if p_bet_type='dozen' and p_choice not in ('dozen1','dozen2','dozen3') then raise exception 'invalid dozen bet'; end if;
    if p_bet_type='column' and p_choice not in ('column1','column2','column3') then raise exception 'invalid column bet'; end if;
    if p_bet_type='number' and p_choice !~ '^number_(0|[1-9]|[12][0-9]|3[0-6])$' then raise exception 'invalid number bet'; end if;
    if p_bet_type not in ('colour','parity','range','dozen','column','number') then raise exception 'invalid roulette bet type'; end if;
  elsif v_round.game_type='coinflip' then
    if p_bet_type<>'side' or p_choice not in ('heads','tails') then raise exception 'choose heads or tails'; end if;
  elsif v_round.game_type='dice' then
    if p_bet_type<>'side' or p_choice not in ('low','high') then raise exception 'choose low or high'; end if;
  else raise exception 'unsupported casino game'; end if;
  select balance into v_balance from public.wallets where user_id=v_uid for update;
  if v_balance is null or v_balance<p_stake then raise exception 'not enough coins'; end if;
  perform public.internal_adjust(v_uid,-p_stake,'casino:bet:'||p_round_id::text);
  insert into public.casino_bets(round_id,table_id,user_id,bet_type,choice,stake)
  values(p_round_id,v_table.id,v_uid,p_bet_type,p_choice,p_stake) returning id into v_bet_id;
  select balance into v_balance from public.wallets where user_id=v_uid;
  return jsonb_build_object('bet_id',v_bet_id,'round_id',p_round_id,'stake',p_stake,'balance',v_balance);
end $$;

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
  if not exists(select 1 from public.casino_table_members where table_id=v_round.table_id and user_id=v_uid and role='player') then raise exception 'only seated players can settle this round' using errcode='42501'; end if;
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

create or replace function public.send_casino_message(p_table_id uuid,p_message text)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id bigint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_message is null or char_length(trim(p_message)) not between 1 and 500 then raise exception 'message must be 1–500 characters' using errcode='22023'; end if;
  if not exists(select 1 from public.casino_table_members where table_id=p_table_id and user_id=v_uid) then raise exception 'join the table before chatting' using errcode='42501'; end if;
  insert into public.casino_chat_messages(table_id,user_id,message) values(p_table_id,v_uid,trim(p_message)) returning id into v_id;
  return jsonb_build_object('message_id',v_id);
end $$;

create or replace function public.create_casino_challenge(p_opponent_id uuid,p_stake bigint,p_choice text)
returns uuid language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_opponent_id is null or p_opponent_id=v_uid then raise exception 'choose another player'; end if;
  if p_stake is null or p_stake not between 1 and 5000 then raise exception 'stake must be between 1 and 5,000 coins'; end if;
  if p_choice not in ('heads','tails') then raise exception 'choose heads or tails'; end if;
  if not exists(select 1 from public.profiles where id=p_opponent_id) then raise exception 'player not found'; end if;
  insert into public.casino_challenges(challenger_id,opponent_id,stake,challenger_choice) values(v_uid,p_opponent_id,p_stake,p_choice) returning id into v_id;
  return v_id;
end $$;

create or replace function public.accept_casino_challenge(p_challenge_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_challenge public.casino_challenges%rowtype; v_byte integer; v_outcome text; v_winner uuid; v_balance bigint;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_challenge from public.casino_challenges where id=p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  if v_challenge.opponent_id<>v_uid then raise exception 'only the challenged player can accept' using errcode='42501'; end if;
  if v_challenge.status<>'pending' then raise exception 'challenge is no longer pending'; end if;
  if now()>=v_challenge.expires_at then update public.casino_challenges set status='expired' where id=p_challenge_id; return jsonb_build_object('status','expired'); end if;
  perform 1 from public.wallets where user_id in (v_challenge.challenger_id,v_challenge.opponent_id) order by user_id for update;
  if (select balance from public.wallets where user_id=v_challenge.challenger_id)<v_challenge.stake then raise exception 'challenger no longer has enough coins'; end if;
  if (select balance from public.wallets where user_id=v_challenge.opponent_id)<v_challenge.stake then raise exception 'you do not have enough coins'; end if;
  perform public.internal_adjust(v_challenge.challenger_id,-v_challenge.stake,'casino:challenge:stake:'||p_challenge_id::text);
  perform public.internal_adjust(v_challenge.opponent_id,-v_challenge.stake,'casino:challenge:stake:'||p_challenge_id::text);
  v_byte:=get_byte(extensions.gen_random_bytes(1),0); v_outcome:=case when v_byte<128 then 'heads' else 'tails' end;
  v_winner:=case when v_outcome=v_challenge.challenger_choice then v_challenge.challenger_id else v_challenge.opponent_id end;
  v_balance:=public.internal_adjust(v_winner,v_challenge.stake*2,'casino:challenge:win:'||p_challenge_id::text);
  update public.casino_challenges set status='settled',outcome=v_outcome,winner_id=v_winner,settled_at=now() where id=p_challenge_id;
  return jsonb_build_object('status','settled','outcome',v_outcome,'winner_id',v_winner,'stake_each',v_challenge.stake,'winner_payout',v_challenge.stake*2);
end $$;

create or replace function public.decline_casino_challenge(p_challenge_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  update public.casino_challenges set status='declined' where id=p_challenge_id and opponent_id=v_uid and status='pending';
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'challenge not found or no longer pending'; end if;
  return jsonb_build_object('status','declined');
end $$;

create or replace function public.cancel_casino_challenge(p_challenge_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  update public.casino_challenges set status='cancelled' where id=p_challenge_id and challenger_id=v_uid and status='pending';
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'challenge not found or no longer pending'; end if;
  return jsonb_build_object('status','cancelled');
end $$;

create or replace function public.get_casino_leaderboard(p_limit integer default 20)
returns table(user_id uuid,username text,display_name text,games bigint,wins bigint,net_profit bigint)
language sql security definer set search_path=public,pg_temp as $$
  select p.id,p.username,p.display_name,count(b.id)::bigint,count(b.id) filter(where b.status='won')::bigint,coalesce(sum(b.net),0)::bigint
  from public.profiles p join public.casino_bets b on b.user_id=p.id
  where b.status in ('won','lost') group by p.id,p.username,p.display_name
  order by coalesce(sum(b.net),0) desc,count(b.id) desc limit greatest(1,least(coalesce(p_limit,20),100));
$$;

revoke all on function public.create_casino_table(text,text,text,smallint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.join_casino_table(uuid,text,text) from public,anon,authenticated;
revoke all on function public.leave_casino_table(uuid) from public,anon,authenticated;
revoke all on function public.start_casino_round(uuid) from public,anon,authenticated;
revoke all on function public.place_casino_bet(uuid,text,text,bigint) from public,anon,authenticated;
revoke all on function public.settle_casino_round(uuid) from public,anon,authenticated;
revoke all on function public.send_casino_message(uuid,text) from public,anon,authenticated;
revoke all on function public.create_casino_challenge(uuid,bigint,text) from public,anon,authenticated;
revoke all on function public.accept_casino_challenge(uuid) from public,anon,authenticated;
revoke all on function public.decline_casino_challenge(uuid) from public,anon,authenticated;
revoke all on function public.cancel_casino_challenge(uuid) from public,anon,authenticated;
revoke all on function public.get_casino_leaderboard(integer) from public,anon,authenticated;
grant execute on function public.create_casino_table(text,text,text,smallint,bigint,bigint) to authenticated;
grant execute on function public.join_casino_table(uuid,text,text) to authenticated;
grant execute on function public.leave_casino_table(uuid) to authenticated;
grant execute on function public.start_casino_round(uuid) to authenticated;
grant execute on function public.place_casino_bet(uuid,text,text,bigint) to authenticated;
grant execute on function public.settle_casino_round(uuid) to authenticated;
grant execute on function public.send_casino_message(uuid,text) to authenticated;
grant execute on function public.create_casino_challenge(uuid,bigint,text) to authenticated;
grant execute on function public.accept_casino_challenge(uuid) to authenticated;
grant execute on function public.decline_casino_challenge(uuid) to authenticated;
grant execute on function public.cancel_casino_challenge(uuid) to authenticated;
grant execute on function public.get_casino_leaderboard(integer) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_tables') then alter publication supabase_realtime add table public.casino_tables; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_table_members') then alter publication supabase_realtime add table public.casino_table_members; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_rounds') then alter publication supabase_realtime add table public.casino_rounds; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_bets') then alter publication supabase_realtime add table public.casino_bets; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_chat_messages') then alter publication supabase_realtime add table public.casino_chat_messages; end if;
end $$;
