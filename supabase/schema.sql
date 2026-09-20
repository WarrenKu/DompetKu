create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  slug text not null unique,
  initials text not null,
  bank_id text not null unique,
  pin_code text,
  notifications_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists notifications_read_at timestamptz;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_number text not null unique,
  balance numeric(14, 2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  amount numeric(14, 2) not null,
  merchant text,
  note text,
  status text not null default 'berhasil',
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists status text not null default 'berhasil';

create or replace function public.generate_transaction_ref()
returns text
language plpgsql
as $$
begin
  return 'SUMA-KK' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
end;
$$;

alter table public.transactions
  add column if not exists ref_code text;

alter table public.transactions
  alter column ref_code set default public.generate_transaction_ref();

update public.transactions
  set ref_code = public.generate_transaction_ref()
where ref_code is null;

alter table public.transactions
  alter column ref_code set not null;

create unique index if not exists transactions_ref_code_key
  on public.transactions (ref_code);

create table if not exists public.transfer_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rail text not null,
  bank_name text not null,
  bank_code text,
  account_name text not null,
  account_number text not null,
  created_at timestamptz not null default now()
);

create or replace function public.slugify_name(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, 'user')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.make_initials(value text)
returns text
language plpgsql
immutable
as $$
declare
  parts text[];
  result text;
begin
  parts := regexp_split_to_array(trim(coalesce(value, 'Kantong User')), '\s+');
  result := upper(left(parts[1], 1) || coalesce(left(parts[2], 1), 'K'));
  return result;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  base_slug text;
  final_slug text;
  suffix text;
  generated_bank_id text;
begin
  clean_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Kantong User');
  base_slug := nullif(public.slugify_name(clean_name), '');
  if base_slug is null then
    base_slug := 'user';
  end if;

  final_slug := base_slug;
  suffix := right(replace(gen_random_uuid()::text, '-', ''), 5);

  if exists (select 1 from public.profiles where slug = final_slug) then
    final_slug := base_slug || '-' || suffix;
  end if;

  generated_bank_id := 'KK-' || upper(left(regexp_replace(clean_name, '[^a-zA-Z]', '', 'g') || 'USR', 3)) || '-' || upper(suffix);

  insert into public.profiles (id, email, full_name, slug, initials, bank_id)
  values (new.id, new.email, clean_name, final_slug, public.make_initials(clean_name), generated_bank_id);

  insert into public.accounts (user_id, account_number, balance)
  values (new.id, '8808' || lpad(floor(random() * 100000000)::text, 8, '0'), 0);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.transfer_recipients enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant select on public.accounts to authenticated;
grant update on public.accounts to authenticated;
grant select on public.transactions to authenticated;
grant insert on public.transactions to authenticated;
grant select, insert, delete on public.transfer_recipients to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'accounts'
  ) then
    alter publication supabase_realtime add table public.accounts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

drop policy if exists "profiles readable for sign in lookup" on public.profiles;
create policy "profiles readable for sign in lookup"
  on public.profiles for select
  using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "users read own accounts" on public.accounts;
create policy "users read own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists "users update own accounts" on public.accounts;
create policy "users update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users read own transactions" on public.transactions;
create policy "users read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "users create own transactions" on public.transactions;
create policy "users create own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users read own transfer recipients" on public.transfer_recipients;
create policy "users read own transfer recipients"
  on public.transfer_recipients for select
  using (auth.uid() = user_id);

drop policy if exists "users create own transfer recipients" on public.transfer_recipients;
create policy "users create own transfer recipients"
  on public.transfer_recipients for insert
  with check (auth.uid() = user_id);

drop policy if exists "users delete own transfer recipients" on public.transfer_recipients;
create policy "users delete own transfer recipients"
  on public.transfer_recipients for delete
  using (auth.uid() = user_id);

create or replace function public.transfer_kantong(
  p_recipient_id uuid,
  p_amount numeric,
  p_merchant text,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_id uuid := auth.uid();
  sender_balance numeric(14, 2);
  sender_name text;
  recipient_name text;
  next_sender_balance numeric(14, 2);
begin
  if sender_id is null then
    raise exception 'User belum login.';
  end if;

  if p_recipient_id is null or p_recipient_id = sender_id then
    raise exception 'Tujuan transfer tidak valid.';
  end if;

  if p_amount is null or p_amount < 1000 then
    raise exception 'Nominal minimal Rp1.000.';
  end if;

  select full_name
    into sender_name
  from public.profiles
  where id = sender_id;

  select full_name
    into recipient_name
  from public.profiles
  where id = p_recipient_id;

  if recipient_name is null then
    raise exception 'Penerima tidak ditemukan.';
  end if;

  select balance
    into sender_balance
  from public.accounts
  where user_id = sender_id
  for update;

  if sender_balance is null then
    raise exception 'Akun saldo belum siap.';
  end if;

  if sender_balance < p_amount then
    raise exception 'Saldo tidak cukup untuk transaksi ini.';
  end if;

  update public.accounts
    set balance = balance - p_amount
  where user_id = sender_id
  returning balance into next_sender_balance;

  update public.accounts
    set balance = balance + p_amount
  where user_id = p_recipient_id;

  if not found then
    raise exception 'Rekening penerima tidak ditemukan.';
  end if;

  insert into public.transactions (user_id, type, amount, merchant, note, status)
  values
    (sender_id, 'transfer', -p_amount, 'Transfer keluar ke ' || recipient_name, p_note, 'berhasil'),
    (p_recipient_id, 'income', p_amount, 'Transfer masuk dari ' || coalesce(sender_name, 'KantongKu'), coalesce(p_note, 'Transfer masuk'), 'berhasil');

  return next_sender_balance;
end;
$$;

grant execute on function public.transfer_kantong(uuid, numeric, text, text) to authenticated;

drop function if exists public.lookup_kantong_recipient(text);
create or replace function public.lookup_kantong_recipient(p_identifier text)
returns table (
  id uuid,
  full_name text,
  bank_id text,
  account_number text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.bank_id,
    a.account_number
  from public.profiles p
  join public.accounts a on a.user_id = p.id
  where a.account_number = regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g')
  limit 1;
$$;

grant execute on function public.lookup_kantong_recipient(text) to authenticated;
