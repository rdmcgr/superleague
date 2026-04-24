-- Run this file in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  public_slug text,
  avatar_url text,
  shit_talk text,
  shit_talk_updated_at timestamptz,
  invite_code_used text,
  invite_approved_at timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  code text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;
alter table public.profiles add column if not exists public_slug text;

create or replace function public.slugify_display_name(input_name text)
returns text
language plpgsql
as $$
declare
  cleaned text;
  first_word text;
  last_initial text;
begin
  cleaned := lower(coalesce(input_name, ''));
  cleaned := regexp_replace(cleaned, '[^a-z0-9]+', ' ', 'g');
  cleaned := btrim(regexp_replace(cleaned, '\s+', ' ', 'g'));

  if cleaned = '' then
    return 'player';
  end if;

  first_word := split_part(cleaned, ' ', 1);
  last_initial := left(split_part(cleaned, ' ', array_length(regexp_split_to_array(cleaned, '\s+'), 1)), 1);

  if last_initial = '' or cleaned = first_word then
    return first_word;
  end if;

  return first_word || '-' || last_initial;
end;
$$;

create or replace function public.ensure_unique_public_slug(base_slug text, profile_id uuid)
returns text
language plpgsql
as $$
declare
  candidate text;
  suffix_num int := 1;
begin
  candidate := coalesce(nullif(base_slug, ''), 'player');

  while exists (
    select 1
    from public.profiles p
    where p.public_slug = candidate
      and p.id <> profile_id
  ) loop
    suffix_num := suffix_num + 1;
    candidate := base_slug || '-' || suffix_num::text;
  end loop;

  return candidate;
end;
$$;

create table if not exists public.side_bets (
  id bigint generated always as identity primary key,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  taker_id uuid references public.profiles(id) on delete set null,
  team_a_id bigint not null references public.teams(id),
  team_b_id bigint not null references public.teams(id),
  bet_type text not null check (bet_type in ('moneyline', 'spread')),
  spread_team_id bigint references public.teams(id),
  spread_value numeric(4,1),
  stake_amount numeric(10,2) not null,
  description text,
  status text not null default 'open' check (status in ('open', 'taken', 'closed', 'cancelled')),
  creator_selected_winner_id uuid references public.profiles(id) on delete set null,
  taker_selected_winner_id uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.side_bet_comments (
  id bigint generated always as identity primary key,
  bet_id bigint not null references public.side_bets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shit_talk_replies (
  id bigint generated always as identity primary key,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  target_shit_talk_updated_at timestamptz not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) <= 200),
  created_at timestamptz not null default now()
);

alter table public.side_bets add column if not exists winner_id uuid references public.profiles(id) on delete set null;
alter table public.side_bets add column if not exists settled_at timestamptz;
alter table public.side_bets add column if not exists creator_selected_winner_id uuid references public.profiles(id) on delete set null;
alter table public.side_bets add column if not exists taker_selected_winner_id uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'side_bets_winner_check'
  ) then
    alter table public.side_bets
    add constraint side_bets_winner_check
    check (
      winner_id is null
      or winner_id = creator_id
      or winner_id = taker_id
    );
  end if;
end;
$$;

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
declare
  generated_slug text;
begin
  generated_slug := public.ensure_unique_public_slug(
    public.slugify_display_name(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))),
    new.id
  );

  insert into public.profiles (id, email, display_name, public_slug, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    generated_slug,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

update public.profiles p
set public_slug = public.ensure_unique_public_slug(
  public.slugify_display_name(coalesce(p.display_name, split_part(p.email, '@', 1))),
  p.id
)
where p.public_slug is null;

create unique index if not exists profiles_public_slug_idx on public.profiles (public_slug);

alter table public.profiles enable row level security;
alter table public.chapters enable row level security;
alter table public.questions enable row level security;
alter table public.teams enable row level security;
alter table public.picks enable row level security;
alter table public.results enable row level security;
alter table public.result_teams enable row level security;
alter table public.side_bets enable row level security;
alter table public.side_bet_comments enable row level security;
alter table public.shit_talk_replies enable row level security;

-- Profiles
create policy "Profiles readable by authenticated users"
on public.profiles
for select
using (
  auth.role() = 'authenticated'
  and (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.invite_code_used is not null or p.is_admin)
    )
  )
);

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
    -- Allow admins to reset the cooldown by setting shit_talk_updated_at to NULL.
    if new.shit_talk_updated_at is null and new.shit_talk is not distinct from old.shit_talk then
      return new;
    end if;
    if new.shit_talk is distinct from old.shit_talk then
      new.shit_talk_updated_at = now();
    end if;
    return new;
  end if;

  if new.shit_talk is distinct from old.shit_talk then
    if coalesce(nullif(btrim(old.shit_talk), ''), null) is not null
      and old.shit_talk_updated_at is not null
      and now() < old.shit_talk_updated_at + interval '24 hours' then
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

create or replace function public.delete_user_by_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_is_admin boolean;
begin
  select p.is_admin into actor_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(actor_is_admin, false) = false then
    raise exception 'Only admins can delete users';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Admins cannot delete themselves';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

create or replace function public.clear_shit_talk_by_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_is_admin boolean;
begin
  select p.is_admin into actor_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(actor_is_admin, false) = false then
    raise exception 'Only admins can clear shit talk';
  end if;

  update public.profiles
  set shit_talk = null, shit_talk_updated_at = null
  where id = target_user_id;
end;
$$;

create or replace function public.reset_shit_talk_cooldown_by_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_is_admin boolean;
begin
  select p.is_admin into actor_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(actor_is_admin, false) = false then
    raise exception 'Only admins can reset cooldowns';
  end if;

  update public.profiles
  set shit_talk_updated_at = null
  where id = target_user_id;
end;
$$;

create or replace function public.delete_shit_talk_reply_by_admin(target_reply_id bigint)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_is_admin boolean;
begin
  select p.is_admin into actor_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(actor_is_admin, false) = false then
    raise exception 'Only admins can delete shit talk replies';
  end if;

  delete from public.shit_talk_replies
  where id = target_reply_id;
end;
$$;

-- Chapters, questions, teams, results readable to all authenticated users
create policy "Chapters readable"
on public.chapters
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Questions readable"
on public.questions
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Teams readable"
on public.teams
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Results readable"
on public.results
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Result teams readable"
on public.result_teams
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Side bets readable"
on public.side_bets
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Side bet comments readable"
on public.side_bet_comments
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Shit talk replies readable"
on public.shit_talk_replies
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

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
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

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
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
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
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
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
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.chapters c
    where c.id = chapter_id
      and c.status = 'open'
  )
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
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
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Users can create side bets"
on public.side_bets
for insert
with check (
  creator_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Users can update their own open bets"
on public.side_bets
for update
using (
  creator_id = auth.uid()
  and status = 'open'
)
with check (
  creator_id = auth.uid()
  and status in ('open', 'cancelled')
);

create policy "Users can take open bets"
on public.side_bets
for update
using (
  status = 'open'
  and creator_id <> auth.uid()
)
with check (
  status in ('taken', 'open')
);

create policy "Creators can settle taken bets"
on public.side_bets
for update
using (
  creator_id = auth.uid()
  and status = 'taken'
)
with check (
  creator_id = auth.uid()
  and status in ('taken', 'closed')
);

create policy "Takers can settle taken bets"
on public.side_bets
for update
using (
  taker_id = auth.uid()
  and status = 'taken'
)
with check (
  taker_id = auth.uid()
  and status in ('taken', 'closed')
);

create policy "Admins can settle any bet"
on public.side_bets
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

create policy "Users can create bet comments"
on public.side_bet_comments
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create policy "Users can create shit talk replies"
on public.shit_talk_replies
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.invite_code_used is not null or p.is_admin)
  )
);

create or replace function public.redeem_invite_code(input_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.invite_codes c
    where c.code = input_code and c.is_active = true
  ) then
    raise exception 'Invalid invite code';
  end if;

  update public.profiles
  set invite_code_used = input_code, invite_approved_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.enforce_invite_code_change()
returns trigger
language plpgsql
as $$
begin
  if new.invite_code_used is distinct from old.invite_code_used then
    if new.invite_code_used is null then
      return new;
    end if;
    if not exists (
      select 1 from public.invite_codes c
      where c.code = new.invite_code_used and c.is_active = true
    ) then
      raise exception 'Invalid invite code';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_invite_code_change_trigger on public.profiles;
create trigger enforce_invite_code_change_trigger
before update on public.profiles
for each row
execute function public.enforce_invite_code_change();

insert into public.invite_codes (code, is_active)
values
  ('moorefun', true),
  ('superbedparty', true)
on conflict (code) do nothing;

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
where p.is_admin = false and p.invite_code_used is not null
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
