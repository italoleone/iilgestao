
create type public.app_role as enum ('admin_geral', 'admin', 'planejamento', 'projetista');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  discipline text,
  cost_per_hour numeric default 0,
  monthly_capacity_hours integer default 176,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create or replace function public.get_user_role(_user_id uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_roles
  where user_id = _user_id
  limit 1
$$;

create policy "Users can view own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "Admins can view all profiles" on public.profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin_geral') or public.has_role(auth.uid(), 'admin'));

create policy "Users can update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

create policy "Admins can insert profiles" on public.profiles
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin_geral') or public.has_role(auth.uid(), 'admin'));

create policy "Users can view own role" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create policy "Admins can view all roles" on public.user_roles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin_geral') or public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin_geral'));
