create table if not exists public.community_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  level_data jsonb not null,
  plays integer not null default 0,
  deaths integer not null default 0,
  successes integer not null default 0,
  rating_total integer not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.community_levels enable row level security;

drop policy if exists "community levels are readable" on public.community_levels;
create policy "community levels are readable"
on public.community_levels
for select
using (true);

drop policy if exists "community levels are publishable" on public.community_levels;
create policy "community levels are publishable"
on public.community_levels
for insert
with check (true);

drop policy if exists "community levels stats are writable" on public.community_levels;
create policy "community levels stats are writable"
on public.community_levels
for update
using (true)
with check (true);

create table if not exists public.community_level_votes (
  id bigint generated always as identity primary key,
  level_id uuid not null references public.community_levels(id) on delete cascade,
  voter_id text not null,
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (level_id, voter_id)
);

alter table public.community_level_votes enable row level security;

drop policy if exists "community votes are insertable once" on public.community_level_votes;
create policy "community votes are insertable once"
on public.community_level_votes
for insert
with check (true);

create or replace function public.update_level_rating_from_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_levels
  set
    rating_total = rating_total + new.stars,
    rating_count = rating_count + 1
  where id = new.level_id;

  return new;
end;
$$;

drop trigger if exists community_level_votes_after_insert on public.community_level_votes;
create trigger community_level_votes_after_insert
after insert on public.community_level_votes
for each row
execute function public.update_level_rating_from_vote();
