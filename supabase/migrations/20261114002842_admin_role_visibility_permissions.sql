drop policy if exists admin_permissions_read on public.admin_permissions;
create policy admin_permissions_read on public.admin_permissions for select to authenticated
using ((select private.admin_has_permission('roles.view')) or (select private.admin_has_permission('roles.manage')));
drop policy if exists admin_roles_read on public.admin_roles;
create policy admin_roles_read on public.admin_roles for select to authenticated
using ((select private.admin_has_permission('roles.view')) or (select private.admin_has_permission('roles.manage')) or (select private.admin_has_permission('roles.assign')));
drop policy if exists admin_role_permissions_read on public.admin_role_permissions;
create policy admin_role_permissions_read on public.admin_role_permissions for select to authenticated
using ((select private.admin_has_permission('roles.view')) or (select private.admin_has_permission('roles.manage')));
drop policy if exists admin_user_roles_read on public.admin_user_roles;
create policy admin_user_roles_read on public.admin_user_roles for select to authenticated
using (user_id=(select auth.uid()) or (select private.admin_has_permission('roles.view')) or (select private.admin_has_permission('players.view')) or (select private.admin_has_permission('roles.assign')));
