-- ═══════════════════════════════════════════════════════════
-- CAPSULES — SUPABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── PROFILES ──────────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  email text,
  bio text default '',
  interests text[] default '{}',
  avatar_color text default '#3a3028',
  depth_score integer default 0,
  capsule_count integer default 0,
  response_count integer default 0,
  total_read_seconds_given integer default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);


-- ── CAPSULES ──────────────────────────────────────────────
create table if not exists capsules (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null check (length(content) >= 50),
  tags text[] default '{}',
  is_published boolean default false,
  created_at timestamptz default now(),
  publishes_at timestamptz not null,  -- created_at + 3 hours
  read_count integer default 0,
  total_read_seconds integer default 0,
  response_count integer default 0,
  reaction_count integer default 0,
  depth_feed_score float default 0  -- computed by update_depth_scores()
);

alter table capsules enable row level security;

-- Anyone can read published capsules
create policy "Published capsules are public"
  on capsules for select
  using (is_published = true and publishes_at <= now());

-- Author can see their own pending capsules
create policy "Authors see their own pending capsules"
  on capsules for select
  using (auth.uid() = author_id);

-- Authenticated users can insert
create policy "Authenticated users can create capsules"
  on capsules for insert
  with check (auth.uid() = author_id);

-- Authors can only delete their own UNPUBLISHED capsules (the core rule)
create policy "Authors can withdraw unpublished capsules only"
  on capsules for delete
  using (auth.uid() = author_id and publishes_at > now() and is_published = false);

-- No updates allowed by users (permanence enforced)
-- Updates only happen via server-side functions (depth score, counters)


-- ── RESPONSES ─────────────────────────────────────────────
create table if not exists responses (
  id uuid default gen_random_uuid() primary key,
  capsule_id uuid references capsules(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null check (length(content) >= 20),
  is_published boolean default false,
  created_at timestamptz default now(),
  publishes_at timestamptz not null,
  reaction_count integer default 0
);

alter table responses enable row level security;

create policy "Published responses are public"
  on responses for select
  using (is_published = true and publishes_at <= now());

create policy "Authors see their own pending responses"
  on responses for select
  using (auth.uid() = author_id);

create policy "Authenticated users can create responses"
  on responses for insert
  with check (auth.uid() = author_id);

create policy "Authors can withdraw unpublished responses"
  on responses for delete
  using (auth.uid() = author_id and publishes_at > now() and is_published = false);


-- ── REACTIONS ─────────────────────────────────────────────
create table if not exists reactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  capsule_id uuid references capsules(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, capsule_id)
);

alter table reactions enable row level security;

create policy "Reactions are viewable by everyone"
  on reactions for select using (true);

create policy "Users can manage their own reactions"
  on reactions for insert with check (auth.uid() = user_id);

create policy "Users can delete their own reactions"
  on reactions for delete using (auth.uid() = user_id);


-- ── READ EVENTS (depth algo input) ────────────────────────
create table if not exists read_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  capsule_id uuid references capsules(id) on delete cascade not null,
  read_seconds integer not null,
  recorded_at timestamptz default now(),
  unique(user_id, capsule_id)  -- one record per user per capsule, upserted
);

alter table read_events enable row level security;

create policy "Users can insert their own read events"
  on read_events for insert with check (auth.uid() = user_id);

create policy "Users can update their own read events"
  on read_events for update using (auth.uid() = user_id);

create policy "Read events are private"
  on read_events for select using (auth.uid() = user_id);


-- ── NEWS ITEMS ────────────────────────────────────────────
create table if not exists news_items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  summary text not null,
  source text not null,
  source_url text,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table news_items enable row level security;

create policy "News is public"
  on news_items for select using (true);

-- Seed with sample news items
insert into news_items (title, summary, source, published_at) values
(
  'Federal Reserve holds rates steady, signals cautious approach to cuts',
  'The Federal Open Market Committee voted unanimously to maintain the federal funds rate at its current target range. Chair Powell indicated policymakers need further evidence of sustained disinflation before considering rate reductions, citing labor market resilience as a complicating factor.',
  'Reuters',
  now() - interval '1 hour'
),
(
  'UN climate panel releases landmark report on adaptation for developing nations',
  'The IPCC latest synthesis report focuses on adaptation pathways for developing nations facing disproportionate climate risk relative to their historical emissions. The report calls for a restructuring of climate finance mechanisms and questions the sufficiency of current international pledges.',
  'Associated Press',
  now() - interval '2 hours'
),
(
  'AI investment surges past $300B in 2025, raising questions about concentration of capability',
  'Total private investment in artificial intelligence infrastructure reached a record $312 billion in 2025, with roughly 60% concentrated among five firms. Economists and policymakers are increasingly focused on whether existing antitrust frameworks are adequate to address the structural dynamics of the sector.',
  'Financial Times',
  now() - interval '4 hours'
),
(
  'New study challenges standard model of memory consolidation during sleep',
  'Researchers at the Karolinska Institute have published findings suggesting that slow-wave sleep may play a more active role in memory reordering than previously understood. The study involved direct cortical recording in human subjects and contradicts several assumptions built into existing cognitive models.',
  'Nature',
  now() - interval '6 hours'
);


-- ═══════════════════════════════════════════════════════════
-- DEPTH SCORE ALGORITHM
-- ═══════════════════════════════════════════════════════════
-- 
-- The depth_feed_score for each capsule is calculated as:
--
--   score = (avg_read_ratio * 40)       -- time spent vs expected read time
--         + (response_depth * 30)       -- quality of responses it generated  
--         + (recency_boost * 20)        -- freshness (decays over 7 days)
--         + (topic_match_bonus * 10)    -- not used here, applied client-side
--
-- This runs every 15 minutes via pg_cron (set up separately)
-- or can be triggered manually.
-- ═══════════════════════════════════════════════════════════

create or replace function update_capsule_depth_scores()
returns void
language plpgsql
security definer
as $$
declare
  words_per_minute constant float := 200.0;
  max_read_ratio constant float := 3.0; -- cap at 3x expected read time
begin
  update capsules c
  set depth_feed_score = (
    -- Component 1: Read engagement (40 points max)
    -- avg_read_seconds vs expected_read_seconds based on word count
    -- Higher = people are actually reading, not skimming
    coalesce(
      least(
        (
          select avg(re.read_seconds)::float /
                 greatest(
                   (length(c.content) - length(replace(c.content, ' ', '')) + 1)::float / words_per_minute * 60.0,
                   10.0
                 )
          from read_events re
          where re.capsule_id = c.id
        ),
        max_read_ratio
      ) / max_read_ratio * 40.0,
      0.0
    )

    -- Component 2: Response depth score (30 points max)
    -- Rewards capsules that generate substantive responses (long, multiple)
    + coalesce(
      least(
        (
          select
            (count(*)::float * 0.4) +  -- number of responses (up to ~10)
            (avg(length(r.content))::float / 500.0 * 0.6)  -- avg response length
          from responses r
          where r.capsule_id = c.id
            and r.is_published = true
        ),
        1.0
      ) * 30.0,
      0.0
    )

    -- Component 3: Recency (20 points max, decays over 7 days)
    + greatest(
        20.0 * (1.0 - extract(epoch from (now() - c.publishes_at)) / (7.0 * 24.0 * 3600.0)),
        0.0
      )

    -- Component 4: Reaction signal (10 points max, logarithmic to prevent gaming)
    + least(
        coalesce(ln(c.reaction_count + 1) / ln(50.0) * 10.0, 0.0),
        10.0
      )
  )
  where c.is_published = true;
end;
$$;


-- ── Function: publish capsules when their window expires ──
-- This is called by a cron job every minute
create or replace function publish_ready_capsules()
returns integer
language plpgsql
security definer
as $$
declare
  published_count integer;
begin
  -- Publish capsules
  update capsules
  set is_published = true
  where is_published = false
    and publishes_at <= now();

  get diagnostics published_count = row_count;

  -- Publish responses
  update responses
  set is_published = true
  where is_published = false
    and publishes_at <= now();

  -- Update author capsule counts
  update profiles p
  set capsule_count = (
    select count(*) from capsules c
    where c.author_id = p.id and c.is_published = true
  );

  -- Update author response counts
  update profiles p
  set response_count = (
    select count(*) from responses r
    where r.author_id = p.id and r.is_published = true
  );

  return published_count;
end;
$$;


-- ── Function: update reaction counts on capsules ──────────
create or replace function update_reaction_count()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update capsules set reaction_count = reaction_count + 1
    where id = NEW.capsule_id;
  elsif TG_OP = 'DELETE' then
    update capsules set reaction_count = reaction_count - 1
    where id = OLD.capsule_id;
  end if;
  return null;
end;
$$;

create trigger on_reaction_change
  after insert or delete on reactions
  for each row execute function update_reaction_count();


-- ── Function: update response count on capsule ────────────
create or replace function update_response_count()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update capsules set response_count = response_count + 1
    where id = NEW.capsule_id;
  end if;
  return null;
end;
$$;

create trigger on_response_insert
  after insert on responses
  for each row execute function update_response_count();


-- ── Set up pg_cron jobs (run after enabling pg_cron extension) ──
-- In Supabase: Database > Extensions > enable pg_cron
-- Then run:

-- select cron.schedule('publish-capsules', '* * * * *', 'select publish_ready_capsules()');
-- select cron.schedule('update-depth-scores', '*/15 * * * *', 'select update_capsule_depth_scores()');

-- ═══════════════════════════════════════════════════════════
-- Done. Your schema is ready.
-- ═══════════════════════════════════════════════════════════
