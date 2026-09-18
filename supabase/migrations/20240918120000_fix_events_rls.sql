drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (
  created_by = auth.uid()
  or public.has_event_role(id, array['owner','editor','viewer']::text[])
  or public.is_admin()
);
