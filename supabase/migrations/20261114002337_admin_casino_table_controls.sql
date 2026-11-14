create or replace function public.admin_get_casino_tables()
returns table(table_id uuid,table_name text,game_type text,visibility text,status text,host_id uuid,host_name text,
  player_count bigint,spectator_count bigint,max_players smallint,min_bet bigint,max_bet bigint,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('casino.view') then raise exception 'permission denied' using errcode='42501'; end if;
  return query
  select t.id,t.name,t.game_type,t.visibility,t.status,t.host_id,p.username,
    (select count(*) from public.casino_table_members m where m.table_id=t.id and m.role='player'),
    (select count(*) from public.casino_table_members m where m.table_id=t.id and m.role='spectator'),
    t.max_players,t.min_bet,t.max_bet,t.created_at
  from public.casino_tables t left join public.profiles p on p.id=t.host_id
  order by (t.status<>'closed') desc,t.created_at desc limit 100;
end $$;

create or replace function public.admin_close_casino_table(p_table_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_table public.casino_tables%rowtype;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('casino.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  select * into v_table from public.casino_tables where id=p_table_id for update;
  if not found then raise exception 'casino table not found'; end if;
  if exists(select 1 from public.casino_rounds where table_id=p_table_id and status='betting') then
    raise exception 'wait for the current betting round to settle before closing this table';
  end if;
  update public.casino_tables set status='closed',updated_at=now() where id=p_table_id;
  perform private.admin_log_action('casino.table.close','casino_table',p_table_id::text,trim(p_reason),
    jsonb_build_object('table_name',v_table.name,'game_type',v_table.game_type,'previous_status',v_table.status));
  return jsonb_build_object('table_id',p_table_id,'status','closed');
end $$;
revoke all on function public.admin_get_casino_tables() from public,anon,authenticated;
revoke all on function public.admin_close_casino_table(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_get_casino_tables() to authenticated;
grant execute on function public.admin_close_casino_table(uuid,text) to authenticated;
