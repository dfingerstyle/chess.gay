create table if not exists public.admin_permissions (
  permission_key text primary key, category text not null, label text not null, description text not null default ''
);
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique check (role_key ~ '^[a-z][a-z0-9_-]{1,31}$'),
  name text not null, description text not null default '', is_system boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_key text not null references public.admin_permissions(permission_key) on delete cascade,
  primary key(role_id,permission_key)
);
create table if not exists public.admin_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null default '', granted_at timestamptz not null default now(),
  primary key(user_id,role_id)
);
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null, target_type text not null, target_id text,
  reason text not null default '', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null check(action_type in ('warning','mute','suspend','ban')),
  reason text not null check(char_length(trim(reason)) between 8 and 500),
  status text not null default 'active' check(status in ('active','revoked','expired')),
  created_at timestamptz not null default now(), expires_at timestamptz,
  revoked_at timestamptz, revoked_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.admin_player_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  note text not null check(char_length(trim(note)) between 2 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.admin_system_settings (
  setting_key text primary key, value jsonb not null, description text not null default '',
  updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.admin_feature_flags (
  flag_key text primary key, enabled boolean not null default false, description text not null default '',
  updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);

create index if not exists admin_role_permissions_permission_idx on public.admin_role_permissions(permission_key);
create index if not exists admin_user_roles_role_idx on public.admin_user_roles(role_id,user_id);
create index if not exists admin_audit_created_idx on public.admin_audit_logs(created_at desc,id desc);
create index if not exists admin_audit_actor_created_idx on public.admin_audit_logs(actor_id,created_at desc);
create index if not exists admin_moderation_target_created_idx on public.admin_moderation_actions(target_user_id,created_at desc);
create index if not exists admin_moderation_status_expiry_idx on public.admin_moderation_actions(status,expires_at);
create index if not exists admin_moderation_actor_created_idx on public.admin_moderation_actions(actor_id,created_at desc);
create index if not exists admin_notes_user_created_idx on public.admin_player_notes(user_id,created_at desc);
create index if not exists admin_notes_author_idx on public.admin_player_notes(author_id);

insert into public.admin_permissions(permission_key,category,label,description) values
('dashboard.view','dashboard','View dashboard','View platform overview and metrics.'),
('players.view','players','View players','Search and inspect player profiles and progression.'),
('players.email.view','players','View player emails','View account email addresses.'),
('players.notes','players','Player support notes','Read and write internal support notes.'),
('moderation.view','moderation','View moderation','View moderation history and restrictions.'),
('moderation.warn','moderation','Issue warnings','Create player warnings.'),
('moderation.mute','moderation','Mute players','Restrict casino table chat.'),
('moderation.suspend','moderation','Suspend players','Temporarily block account sign-in.'),
('moderation.ban','moderation','Ban players','Apply long-term account restrictions.'),
('moderation.revoke','moderation','Revoke restrictions','Revoke active moderation actions.'),
('economy.view','economy','View economy','View wallet and transaction aggregates.'),
('economy.adjust','economy','Adjust balances','Grant or remove virtual coins with a reason.'),
('casino.view','casino','View casino','View casino metrics and betting activity.'),
('casino.manage','casino','Manage casino tables','Manage casino tables and review suspicious activity.'),
('chess.view','chess','View chess','View chess rooms and match activity.'),
('chess.manage','chess','Manage chess','Manage chess rooms and match administration.'),
('content.view','content','View content','View events, quests and announcements.'),
('content.manage','content','Manage content','Manage platform content and rewards.'),
('analytics.view','analytics','View analytics','View platform analytics.'),
('audit.view','security','View audit logs','Read the immutable administrator audit trail.'),
('security.view','security','View security','View security status and platform controls.'),
('security.manage','security','Manage security','Change sensitive security settings.'),
('settings.view','settings','View settings','View platform settings and feature flags.'),
('settings.manage','settings','Manage settings','Change maintenance mode and feature flags.'),
('roles.view','roles','View roles','View custom roles and their permissions.'),
('roles.manage','roles','Manage roles','Create, edit and delete custom roles and permissions.'),
('roles.assign','roles','Assign roles','Assign or remove roles from players.')
on conflict(permission_key) do nothing;

insert into public.admin_roles(role_key,name,description,is_system) values
('owner','Owner','Full platform ownership and unrestricted administration.',true),
('admin','Administrator','Broad platform operations with guarded sensitive actions.',true),
('casino_manager','Casino Manager','Casino operations, tables and analytics.',true),
('moderator','Moderator','Player safety and moderation tools.',true),
('support','Support','Read-only player support and internal notes.',true)
on conflict(role_key) do nothing;

insert into public.admin_role_permissions(role_id,permission_key)
select r.id,p.permission_key from public.admin_roles r cross join public.admin_permissions p
where r.role_key='owner' on conflict do nothing;
insert into public.admin_role_permissions(role_id,permission_key)
select r.id,p.permission_key from public.admin_roles r join public.admin_permissions p on p.permission_key=any(array[
'dashboard.view','players.view','players.notes','moderation.view','moderation.warn','moderation.mute','moderation.suspend','moderation.revoke',
'economy.view','economy.adjust','casino.view','casino.manage','chess.view','chess.manage','content.view','content.manage','analytics.view','audit.view','security.view','settings.view','roles.view'])
where r.role_key='admin' on conflict do nothing;
insert into public.admin_role_permissions(role_id,permission_key)
select r.id,p.permission_key from public.admin_roles r join public.admin_permissions p on p.permission_key=any(array[
'dashboard.view','players.view','casino.view','casino.manage','analytics.view'])
where r.role_key='casino_manager' on conflict do nothing;
insert into public.admin_role_permissions(role_id,permission_key)
select r.id,p.permission_key from public.admin_roles r join public.admin_permissions p on p.permission_key=any(array[
'dashboard.view','players.view','moderation.view','moderation.warn','moderation.mute','moderation.suspend','moderation.revoke','audit.view'])
where r.role_key='moderator' on conflict do nothing;
insert into public.admin_role_permissions(role_id,permission_key)
select r.id,p.permission_key from public.admin_roles r join public.admin_permissions p on p.permission_key=any(array[
'dashboard.view','players.view','players.notes','moderation.view'])
where r.role_key='support' on conflict do nothing;

insert into public.admin_system_settings(setting_key,value,description) values
('maintenance_mode','false'::jsonb,'Temporarily show a platform maintenance screen to non-admin users.'),
('maintenance_message','"The game room is undergoing maintenance. Please check back soon."'::jsonb,'Message shown during maintenance.')
on conflict(setting_key) do nothing;
insert into public.admin_feature_flags(flag_key,enabled,description) values
('casino_enabled',true,'Enable the virtual casino.'),
('chess_online_enabled',false,'Enable online chess matchmaking when ready.'),
('four_player_chess_enabled',false,'Enable four-player chess when ready.'),
('tournaments_enabled',false,'Enable tournaments when ready.'),
('community_enabled',true,'Enable community and player discovery.')
on conflict(flag_key) do nothing;

create or replace function private.admin_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.admin_user_roles ur join public.admin_role_permissions rp on rp.role_id=ur.role_id
    where ur.user_id=(select auth.uid()) and rp.permission_key=p_permission
  );
$$;
revoke all on function private.admin_has_permission(text) from public,anon,authenticated,service_role;
grant execute on function private.admin_has_permission(text) to authenticated;
create or replace function private.admin_log_action(p_action text,p_target_type text,p_target_id text,p_reason text default '',p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='28000'; end if;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,reason,metadata)
  values((select auth.uid()),p_action,p_target_type,p_target_id,coalesce(p_reason,''),coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function private.admin_log_action(text,text,text,text,jsonb) from public,anon,authenticated,service_role;

alter table public.admin_permissions enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_user_roles enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_moderation_actions enable row level security;
alter table public.admin_player_notes enable row level security;
alter table public.admin_system_settings enable row level security;
alter table public.admin_feature_flags enable row level security;
grant select on public.admin_permissions,public.admin_roles,public.admin_role_permissions,public.admin_user_roles,
  public.admin_audit_logs,public.admin_moderation_actions,public.admin_player_notes,public.admin_system_settings,public.admin_feature_flags to authenticated;
revoke insert,update,delete on public.admin_permissions,public.admin_roles,public.admin_role_permissions,public.admin_user_roles,
  public.admin_audit_logs,public.admin_moderation_actions,public.admin_player_notes,public.admin_system_settings,public.admin_feature_flags from anon,authenticated;

create policy admin_permissions_read on public.admin_permissions for select to authenticated using ((select private.admin_has_permission('roles.view')));
create policy admin_roles_read on public.admin_roles for select to authenticated using ((select private.admin_has_permission('roles.view')));
create policy admin_role_permissions_read on public.admin_role_permissions for select to authenticated using ((select private.admin_has_permission('roles.view')));
create policy admin_user_roles_read on public.admin_user_roles for select to authenticated using (user_id=(select auth.uid()) or (select private.admin_has_permission('roles.view')) or (select private.admin_has_permission('players.view')));
create policy admin_audit_logs_read on public.admin_audit_logs for select to authenticated using ((select private.admin_has_permission('audit.view')));
create policy admin_moderation_actions_read on public.admin_moderation_actions for select to authenticated using ((select private.admin_has_permission('moderation.view')));
create policy admin_player_notes_read on public.admin_player_notes for select to authenticated using ((select private.admin_has_permission('players.notes')));
create policy admin_system_settings_read on public.admin_system_settings for select to authenticated using ((select private.admin_has_permission('settings.view')));
create policy admin_feature_flags_read on public.admin_feature_flags for select to authenticated using ((select private.admin_has_permission('settings.view')));

do $$
declare v_owner uuid:='0cf3a8b6-5293-4655-a85b-7590707a61db'; v_role uuid;
begin
  select id into v_role from public.admin_roles where role_key='owner';
  if exists(select 1 from auth.users where id=v_owner) then
    insert into public.admin_user_roles(user_id,role_id,granted_by,reason)
    values(v_owner,v_role,v_owner,'Initial project owner bootstrap') on conflict(user_id,role_id) do nothing;
  end if;
end $$;
