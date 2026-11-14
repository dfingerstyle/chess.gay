create or replace function public.leave_casino_table(p_table_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_host uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select host_id into v_host from public.casino_tables where id=p_table_id for update;
  if v_host is null then raise exception 'table not found'; end if;
  if v_host=v_uid and exists(select 1 from public.casino_rounds where table_id=p_table_id and status='betting')
    then raise exception 'settle the open round before closing your table'; end if;
  if v_host=v_uid then update public.casino_tables set status='closed',updated_at=now() where id=p_table_id; end if;
  delete from public.casino_table_members where table_id=p_table_id and user_id=v_uid;
  return jsonb_build_object('table_id',p_table_id,'closed',v_host=v_uid,'left',true);
end $$;
revoke all on function public.leave_casino_table(uuid) from public,anon,authenticated;
grant execute on function public.leave_casino_table(uuid) to authenticated;
