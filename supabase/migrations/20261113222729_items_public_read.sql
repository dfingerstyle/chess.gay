grant select on public.items to anon;
create policy "items readable by guests" on public.items
  for select to anon using (true);
