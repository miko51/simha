-- Pages prestataires : logo, réclamation de fiche, stockage

alter table public.vendors add column if not exists logo_url text;

create or replace function public.vendor_is_listed(vid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendors v
    where v.id = vid
      and v.moderated = true
      and (
        v.free_listing = true
        or v.user_id is not null
        or exists (
          select 1
          from public.subscriptions s
          where s.vendor_id = v.id
            and s.status in ('active', 'trialing')
        )
      )
  );
$$;

drop policy if exists vendors_update on public.vendors;
create policy vendors_update on public.vendors
for update
using (
  user_id = auth.uid()
  or public.is_admin()
  or (user_id is null and public.vendor_is_listed(id))
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (id = auth.uid() and role in ('family', 'vendor'))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-assets',
  'vendor-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vendor_assets_public_read on storage.objects;
drop policy if exists vendor_assets_insert on storage.objects;
drop policy if exists vendor_assets_update on storage.objects;
drop policy if exists vendor_assets_delete on storage.objects;

create policy vendor_assets_public_read on storage.objects
for select using (bucket_id = 'vendor-assets');

create policy vendor_assets_insert on storage.objects
for insert with check (
  bucket_id = 'vendor-assets'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy vendor_assets_update on storage.objects
for update using (
  bucket_id = 'vendor-assets'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy vendor_assets_delete on storage.objects
for delete using (
  bucket_id = 'vendor-assets'
  and split_part(name, '/', 1) = auth.uid()::text
);
