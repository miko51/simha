-- Chat global : messages sans événement (pages publiques) + lecteurs peuvent écrire

alter table public.ai_messages alter column event_id drop not null;

drop policy if exists ai_select on public.ai_messages;
drop policy if exists ai_insert on public.ai_messages;

create policy ai_select on public.ai_messages
for select using (
  public.is_admin()
  or (event_id is not null and public.has_event_role(event_id, array['owner','editor','viewer']::text[]))
  or (event_id is null and user_id = auth.uid())
);

create policy ai_insert on public.ai_messages
for insert with check (
  public.is_admin()
  or (event_id is not null and public.has_event_role(event_id, array['owner','editor','viewer']::text[]))
  or (event_id is null and user_id = auth.uid())
);
