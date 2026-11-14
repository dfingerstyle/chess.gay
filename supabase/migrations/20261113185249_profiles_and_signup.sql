-- chess.gay foundation: public player profiles and safe signup provisioning
-- The event-trigger function only needs to run as its owner when DDL events fire.
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 32),
  constraint profiles_bio_length check (char_length(bio) <= 160)
);

create unique index profiles_username_lower_unique on public.profiles (lower(username));
create index profiles_created_at_idx on public.profiles (created_at desc);

alter table public.profiles enable row level security;

grant select on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_url, bio) on public.profiles to authenticated;

create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Players can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_username text;
begin
  generated_username := 'player_' || left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username, display_name)
  values (new.id, generated_username, generated_username);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
