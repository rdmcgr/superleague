-- Run this file in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  shit_talk text,
  shit_talk_updated_at timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'locked', 'graded')),
  opens_at timestamptz,
  locks_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id bigint generated always as identity primary key,
  chapter_id bigint not null references public.chapters(id) on delete cascade,
  prompt text not null,
  order_index int not null,
  points int not null default 10,
  short_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (chapter_id, order_index)
);

create table if not exists public.teams (
  id bigint generated always as identity primary key,
  name text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.picks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id bigint not null references public.questions(id) on delete cascade,
  chapter_id bigint not null references public.chapters(id) on delete cascade,
  team_id bigint not null references public.teams(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id),
  unique (user_id, chapter_id, team_id)
);

create table if not exists public.results (
  question_id bigint primary key references public.questions(id) on delete cascade,
  winning_team_id bigint references public.teams(id),
  points int not null default 10,
  graded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.result_teams (
  question_id bigint not null references public.questions(id) on delete cascade,
  team_id bigint not null references public.teams(id),
  points int not null default 10,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (question_id, team_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_picks_updated_at on public.picks;
create trigger set_picks_updated_at
before update on public.picks
for each row
execute function public.touch_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
        , coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.chapters enable row level security;
alter table public.questions enable row level security;
alter table public.teams enable row level security;
alter table public.picks enable row level security;
alter table public.results enable row level security;
alter table public.result_teams enable row level security;

-- Profiles
create policy "Profiles readable by authenticated users"
on public.profiles
for select
using (auth.role() = 'authenticated');

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
as $$
declare
  actor_is_admin boolean;
begin
  select p.is_admin into actor_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(actor_is_admin, false) = false and new.is_admin <> old.is_admin then
    raise exception 'Only admins can change is_admin';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_admin_flag_trigger on public.profiles;
create trigger protect_admin_flag_trigger
before update on public.profiles
for each row
execute function public.protect_admin_flag();

create or replace function public.enforce_shit_talk_cooldown()
returns trigger
language plpgsql
as $$
declare
  actor_is_admin boolean;
begin
  select p.is_admin into actor_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(actor_is_admin, false) = true then
    new.shit_talk_updated_at = now();
    return new;
  end if;

  if new.shit_talk is distinct from old.shit_talk then
    if old.shit_talk_updated_at is not null and now() < old.shit_talk_updated_at + interval '24 hours' then
      raise exception 'Shit talk can only be changed once every 24 hours';
    end if;
    new.shit_talk_updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_shit_talk_cooldown_trigger on public.profiles;
create trigger enforce_shit_talk_cooldown_trigger
before update on public.profiles
for each row
execute function public.enforce_shit_talk_cooldown();

-- Chapters, questions, teams, results readable to all authenticated users
create policy "Chapters readable"
on public.chapters
for select
using (auth.role() = 'authenticated');

create policy "Questions readable"
on public.questions
for select
using (auth.role() = 'authenticated');

create policy "Teams readable"
on public.teams
for select
using (auth.role() = 'authenticated');

create policy "Results readable"
on public.results
for select
using (auth.role() = 'authenticated');

create policy "Result teams readable"
on public.result_teams
for select
using (auth.role() = 'authenticated');

-- Admin write policies
create policy "Admin can manage chapters"
on public.chapters
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admin can manage questions"
on public.questions
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admin can manage teams"
on public.teams
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admin can manage results"
on public.results
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admin can manage result teams"
on public.result_teams
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Picks policies
create policy "Users can read own picks anytime"
on public.picks
for select
using (user_id = auth.uid());

create policy "All users can read picks after chapter locked"
on public.picks
for select
using (
  exists (
    select 1
    from public.chapters c
    where c.id = picks.chapter_id
      and c.status in ('locked', 'graded')
  )
);

create policy "Users can insert picks in open chapter"
on public.picks
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.chapters c
    where c.id = chapter_id
      and c.status = 'open'
  )
  and exists (
    select 1 from public.questions q
    where q.id = question_id
      and q.chapter_id = chapter_id
      and q.is_active = true
  )
);

create policy "Users can update own picks in open chapter"
on public.picks
for update
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.chapters c
    where c.id = picks.chapter_id
      and c.status = 'open'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.chapters c
    where c.id = chapter_id
      and c.status = 'open'
  )
);

create policy "Users can delete own picks in open chapter"
on public.picks
for delete
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.chapters c
    where c.id = picks.chapter_id
      and c.status = 'open'
  )
);

create or replace view public.standings_live
with (security_invoker = true)
as
select
  p.id as user_id,
  coalesce(p.display_name, p.email) as display_name,
  coalesce(sum(case when rt.team_id is not null then rt.points else 0 end), 0)::int as total_points,
  coalesce(sum(case when rt.team_id is not null then 1 else 0 end), 0)::int as correct_picks,
  count(pk.id)::int as total_picks
from public.profiles p
left join public.picks pk on pk.user_id = p.id
left join public.result_teams rt on rt.question_id = pk.question_id and rt.team_id = pk.team_id
where p.is_admin = false
group by p.id, p.display_name, p.email;

grant select on public.standings_live to authenticated;

insert into public.chapters (slug, name, status)
values
  ('group-stage', 'Group Stage', 'draft'),
  ('knockout-stage', 'Knockout Stage', 'draft')
on conflict (slug) do nothing;

insert into public.questions (chapter_id, prompt, order_index, is_active)
select c.id, x.prompt, x.order_index, true
from public.chapters c
join (
  values
    ('group-stage', 'Pick one team to win Matchday 1.', 1),
    ('group-stage', 'Pick one team to keep a clean sheet in group stage.', 2),
    ('group-stage', 'Pick one team to score 5+ total group-stage goals.', 3),
    ('group-stage', 'Pick one team to finish 1st in its group.', 4),
    ('group-stage', 'Pick one team to qualify for knockout stage.', 5),
    ('knockout-stage', 'Pick one team to win in Round of 16.', 1),
    ('knockout-stage', 'Pick one team to reach semifinals.', 2),
    ('knockout-stage', 'Pick one team to reach the final.', 3)
) as x(slug, prompt, order_index)
  on x.slug = c.slug
where not exists (
  select 1 from public.questions q where q.chapter_id = c.id and q.order_index = x.order_index
);

insert into public.teams (name, code)
values
  -- Hosts
  ('Canada', 'CAN'),
  ('Mexico', 'MEX'),
  ('United States', 'USA'),
  -- AFC (qualified)
  ('Japan', 'JPN'),
  ('IR Iran', 'IRN'),
  ('Uzbekistan', 'UZB'),
  ('Korea Republic', 'KOR'),
  ('Jordan', 'JOR'),
  ('Australia', 'AUS'),
  ('Qatar', 'QAT'),
  ('Saudi Arabia', 'KSA'),
  -- CAF (qualified)
  ('Morocco', 'MAR'),
  ('Tunisia', 'TUN'),
  ('Egypt', 'EGY'),
  ('Algeria', 'ALG'),
  ('Ghana', 'GHA'),
  ('Cape Verde', 'CPV'),
  ('South Africa', 'RSA'),
  ('Cote d''Ivoire', 'CIV'),
  ('Senegal', 'SEN'),
  -- CONCACAF (qualified)
  ('Panama', 'PAN'),
  ('Haiti', 'HAI'),
  ('Curacao', 'CUW'),
  -- CONMEBOL (qualified)
  ('Argentina', 'ARG'),
  ('Brazil', 'BRA'),
  ('Ecuador', 'ECU'),
  ('Uruguay', 'URU'),
  ('Colombia', 'COL'),
  ('Paraguay', 'PAR'),
  -- OFC (qualified)
  ('New Zealand', 'NZL'),
  -- UEFA (qualified)
  ('England', 'ENG'),
  ('France', 'FRA'),
  ('Croatia', 'CRO'),
  ('Portugal', 'POR'),
  ('Norway', 'NOR'),
  ('Germany', 'GER'),
  ('Netherlands', 'NED'),
  ('Belgium', 'BEL'),
  ('Austria', 'AUT'),
  ('Switzerland', 'SUI'),
  ('Spain', 'ESP'),
  ('Scotland', 'SCO'),
  -- Play-off tournament teams (March 2026)
  ('Bolivia', 'BOL'),
  ('Congo DR', 'COD'),
  ('Iraq', 'IRQ'),
  ('Jamaica', 'JAM'),
  ('New Caledonia', 'NCL'),
  ('Suriname', 'SUR')
on conflict (code) do nothing;

-- After your first user signs in, mark yourself as admin:
-- update public.profiles set is_admin = true where email = 'your-email@example.com';
