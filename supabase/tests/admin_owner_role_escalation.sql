-- Static regression guard for the Owner-role self-escalation vulnerability.
-- Run after migrations: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_owner_role_escalation.sql
do $$
declare v_definition text;
begin
  select pg_catalog.pg_get_functiondef('public.admin_assign_role(uuid,uuid,text)'::regprocedure)
    into v_definition;
  if position('v_key=''owner'' then raise exception' in v_definition)=0 then
    raise exception 'admin_assign_role must reject every Owner-role assignment';
  end if;
  if position('p_user_id<>v_actor' in v_definition)>0 then
    raise exception 'legacy self-assignment exception still exists';
  end if;
  if not has_function_privilege('authenticated','public.admin_assign_role(uuid,uuid,text)','EXECUTE') then
    raise exception 'authenticated role lost the admin_assign_role RPC grant';
  end if;
  if has_function_privilege('anon','public.admin_assign_role(uuid,uuid,text)','EXECUTE') then
    raise exception 'anon must not execute admin_assign_role';
  end if;
end $$;
