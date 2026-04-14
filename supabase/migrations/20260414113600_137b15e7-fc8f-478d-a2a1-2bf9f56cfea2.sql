create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  parent_id uuid references public.task_comments(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.task_comments enable row level security;

create policy "Authenticated users can read comments"
  on public.task_comments for select
  to authenticated
  using (true);

create policy "Authenticated users can insert comments"
  on public.task_comments for insert
  to authenticated
  with check (auth.uid() = author_id);