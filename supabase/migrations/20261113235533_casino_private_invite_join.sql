create or replace function public.join_casino_table_by_code(p_code text,p_role text default 'player')
returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_table_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_code is null or char_length(trim(p_code))<6 or char_length(trim(p_code))>16 then raise exception 'enter a valid invite code' using errcode='22023'; end if;
  select id into v_table_id from public.casino_tables
  where code_hash=encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex') and status<>'closed' limit 1;
  if v_table_id is null then raise exception 'invite code not found or table closed'; end if;
  return public.join_casino_table(v_table_id,p_role,upper(trim(p_code)));
end $$;
revoke all on function public.join_casino_table_by_code(text,text) from public,anon,authenticated;
grant execute on function public.join_casino_table_by_code(text,text) to authenticated;
