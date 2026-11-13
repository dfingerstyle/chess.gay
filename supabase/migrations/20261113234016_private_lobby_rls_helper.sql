create or replace function public.is_lobby_member(p_lobby_id uuid)
returns boolean language sql stable security definer
set search_path to 'public','pg_temp'
as $function$
  select exists (select 1 from public.lobby_members m where m.lobby_id=p_lobby_id and m.user_id=auth.uid());
$function$;
revoke all on function public.is_lobby_member(uuid) from public,anon,authenticated;
grant execute on function public.is_lobby_member(uuid) to authenticated;
drop policy if exists "Lobby members can read their lobby" on public.game_lobbies;
drop policy if exists "Players in a lobby can see its seats" on public.lobby_members;
create policy "Lobby members can read their lobby"
  on public.game_lobbies for select to authenticated using (public.is_lobby_member(id));
create policy "Players in a lobby can see its seats"
  on public.lobby_members for select to authenticated using (public.is_lobby_member(lobby_id));