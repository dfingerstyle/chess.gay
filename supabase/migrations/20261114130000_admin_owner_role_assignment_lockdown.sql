-- Prevent a staff account with roles.assign from granting itself the immutable Owner role.
-- The Owner assignment is bootstrapped only by the trusted initial migration.
create or replace function public.admin_assign_role(p_user_id uuid,p_role_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_key text; v_name text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not private.admin_has_permission('roles.assign') then raise exception 'permission denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 or char_length(trim(p_reason))>500 then raise exception 'a reason of 8–500 characters is required'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'player not found'; end if;
  select role_key,name into v_key,v_name from public.admin_roles where id=p_role_id;
  if v_key is null then raise exception 'role not found'; end if;
  if v_key='owner' then raise exception 'the Owner role is immutable and cannot be assigned through the admin panel'; end if;
  insert into public.admin_user_roles(user_id,role_id,granted_by,reason) values(p_user_id,p_role_id,v_actor,trim(p_reason))
  on conflict(user_id,role_id) do nothing;
  perform private.admin_log_action('roles.assign','player',p_user_id::text,trim(p_reason),jsonb_build_object('role_key',v_key,'role_name',v_name));
  return jsonb_build_object('user_id',p_user_id,'role_id',p_role_id,'role_key',v_key,'role_name',v_name);
end $$;
revoke all on function public.admin_assign_role(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_assign_role(uuid,uuid,text) to authenticated;
