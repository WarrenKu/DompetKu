-- Jalankan sekali di Supabase SQL Editor untuk membuat status baca notifikasi
-- tersinkron antar perangkat.
alter table public.profiles
  add column if not exists notifications_read_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
