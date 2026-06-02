insert into storage.buckets (id, name, public)
values ('coverage', 'coverage', true)
on conflict (id) do update set public = true;

create policy "Coverage public read"
on storage.objects for select
using (bucket_id = 'coverage');

create policy "Coverage service write"
on storage.objects for insert to service_role
with check (bucket_id = 'coverage');

create policy "Coverage service update"
on storage.objects for update to service_role
using (bucket_id = 'coverage');

create policy "Coverage service delete"
on storage.objects for delete to service_role
using (bucket_id = 'coverage');