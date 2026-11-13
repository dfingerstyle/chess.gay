create table public.farm_plots (
  user_id uuid not null references public.profiles(id) on delete cascade,
  plot_no smallint not null check (plot_no between 1 and 4),
  seed_item_id text not null references public.items(id),
  planted_at timestamptz not null default now(),
  ready_at timestamptz not null,
  primary key (user_id, plot_no)
);
alter table public.farm_plots enable row level security;
create policy "Players can read their own farm plots"
  on public.farm_plots for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.farm_plots to authenticated;

create table public.fishing_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  fish_item_id text not null references public.items(id),
  created_at timestamptz not null default now()
);
create index fishing_log_user_created_idx on public.fishing_log (user_id, created_at desc);
alter table public.fishing_log enable row level security;
create policy "Players can read their own fishing log"
  on public.fishing_log for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.fishing_log to authenticated;

create or replace function public.plant_carrot(p_plot smallint)
returns jsonb language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_qty integer; v_planted timestamptz; v_ready timestamptz;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_plot is null or p_plot < 1 or p_plot > 4 then raise exception 'choose a plot between 1 and 4' using errcode = '22023'; end if;
  perform 1 from public.inventory where user_id = v_uid and item_id = 'shovel' and qty > 0 for share;
  if not found then raise exception 'you need a shovel before you can farm' using errcode = 'P0001'; end if;
  update public.inventory set qty = qty - 1
  where user_id = v_uid and item_id = 'carrot_seed' and qty > 0 returning qty into v_qty;
  if v_qty is null then raise exception 'you need a carrot seed' using errcode = 'P0001'; end if;
  if v_qty = 0 then delete from public.inventory where user_id = v_uid and item_id = 'carrot_seed'; end if;
  v_planted := now(); v_ready := v_planted + interval '5 minutes';
  insert into public.farm_plots (user_id, plot_no, seed_item_id, planted_at, ready_at)
  values (v_uid, p_plot, 'carrot_seed', v_planted, v_ready);
  return jsonb_build_object('plot', p_plot, 'crop', 'carrot', 'planted_at', v_planted, 'ready_at', v_ready);
end;
$function$;

create or replace function public.harvest_carrot(p_plot smallint)
returns jsonb language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_ready timestamptz; v_xp bigint; v_level integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select ready_at into v_ready from public.farm_plots
  where user_id = v_uid and plot_no = p_plot for update;
  if not found then raise exception 'there is no crop on that plot' using errcode = 'P0001'; end if;
  if now() < v_ready then raise exception 'this crop is still growing' using errcode = 'P0001'; end if;
  delete from public.farm_plots where user_id = v_uid and plot_no = p_plot;
  insert into public.inventory (user_id, item_id, qty) values (v_uid, 'carrot', 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
  update public.wallets set xp = xp + 10,
    level = 1 + floor((xp + 10)::numeric / 100)::integer, updated_at = now()
  where user_id = v_uid returning xp, level into v_xp, v_level;
  if v_xp is null then raise exception 'wallet not found' using errcode = 'P0001'; end if;
  return jsonb_build_object('plot', p_plot, 'item_id', 'carrot', 'qty', 1, 'xp_earned', 10, 'xp', v_xp, 'level', v_level);
end;
$function$;

create or replace function public.fish_once()
returns jsonb language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_available timestamptz; v_roll numeric; v_fish text; v_fish_name text; v_xp bigint; v_level integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  perform 1 from public.inventory where user_id = v_uid and item_id = 'fishing_rod' and qty > 0 for share;
  if not found then raise exception 'you need a fishing rod before you can fish' using errcode = 'P0001'; end if;
  insert into public.cooldowns (user_id, action, available_at)
  values (v_uid, 'fishing', now() + interval '30 seconds')
  on conflict (user_id, action) do update set available_at = excluded.available_at
  where public.cooldowns.available_at <= now()
  returning available_at into v_available;
  if v_available is null then raise exception 'your line needs a moment before the next cast' using errcode = 'P0001'; end if;
  v_roll := random();
  v_fish := case when v_roll < 0.72 then 'minnow' when v_roll < 0.98 then 'bass' else 'golden_koi' end;
  select name into v_fish_name from public.items where id = v_fish;
  insert into public.inventory (user_id, item_id, qty) values (v_uid, v_fish, 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
  insert into public.fishing_log (user_id, fish_item_id) values (v_uid, v_fish);
  update public.wallets set xp = xp + 5,
    level = 1 + floor((xp + 5)::numeric / 100)::integer, updated_at = now()
  where user_id = v_uid returning xp, level into v_xp, v_level;
  if v_xp is null then raise exception 'wallet not found' using errcode = 'P0001'; end if;
  return jsonb_build_object('fish_id', v_fish, 'fish_name', v_fish_name, 'xp_earned', 5, 'xp', v_xp, 'level', v_level, 'next_cast_at', v_available);
end;
$function$;

create or replace function public.do_work()
returns bigint language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_pay bigint; v_available timestamptz;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  insert into public.cooldowns (user_id, action, available_at)
  values (v_uid, 'work', now() + interval '1 hour')
  on conflict (user_id, action) do update set available_at = excluded.available_at
  where public.cooldowns.available_at <= now()
  returning available_at into v_available;
  if v_available is null then raise exception 'work is on cooldown' using errcode = 'P0001'; end if;
  v_pay := 100 + floor(random() * 151)::bigint;
  perform public.internal_adjust(v_uid, v_pay, 'work');
  update public.wallets set xp = xp + 5,
    level = 1 + floor((xp + 5)::numeric / 100)::integer, updated_at = now()
  where user_id = v_uid;
  return v_pay;
end;
$function$;

revoke all on function public.plant_carrot(smallint) from public, anon, authenticated;
revoke all on function public.harvest_carrot(smallint) from public, anon, authenticated;
revoke all on function public.fish_once() from public, anon, authenticated;
revoke all on function public.do_work() from public, anon, authenticated;
grant execute on function public.plant_carrot(smallint) to authenticated;
grant execute on function public.harvest_carrot(smallint) to authenticated;
grant execute on function public.fish_once() to authenticated;
grant execute on function public.do_work() to authenticated;