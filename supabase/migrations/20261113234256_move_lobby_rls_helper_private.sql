create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
create or replace function private.is_lobby_member(p_lobby_id uuid)
returns boolean language sql stable security definer
set search_path to 'public','pg_temp'
as $function$
 select exists(select 1 from public.lobby_members m where m.lobby_id=p_lobby_id and m.user_id=auth.uid());
$function$;
revoke all on function private.is_lobby_member(uuid) from public,anon,authenticated;
grant execute on function private.is_lobby_member(uuid) to authenticated;
drop policy if exists "Lobby members can read their lobby" on public.game_lobbies;
drop policy if exists "Players in a lobby can see its seats" on public.lobby_members;
create policy "Lobby members can read their lobby" on public.game_lobbies for select to authenticated using(private.is_lobby_member(id));
create policy "Players in a lobby can see its seats" on public.lobby_members for select to authenticated using(private.is_lobby_member(lobby_id));
drop function if exists public.is_lobby_member(uuid);