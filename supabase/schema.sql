-- Life Tracker Schema
-- Paste this entire file into the Supabase SQL editor and click Run.

-- Helper: auto-update updated_at on every row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- entries
-- ─────────────────────────────────────────────
create table entries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  entry_date  date        not null,
  entry_time  time,
  type        text        not null,  -- 'weight'|'meal'|'workout'|'cardio'|'sleep'|'expense'|'note'|custom
  raw_text    text,
  source      text        not null,  -- 'form'|'parser'|'manual_edit'
  data        jsonb       not null
);

create index entries_date_idx on entries (entry_date desc);
create index entries_type_idx on entries (type);

create trigger entries_updated_at
  before update on entries
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- exercises
-- ─────────────────────────────────────────────
create table exercises (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  name         text        not null unique,
  muscle_groups text[],
  default_unit text        -- 'kg'|'lb'|'bw'
);

create trigger exercises_updated_at
  before update on exercises
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- foods
-- ─────────────────────────────────────────────
create table foods (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  name                  text        not null unique,
  typical_serving       text,
  kcal_per_serving      numeric,
  protein_g_per_serving numeric,
  cuisine_tag           text,
  last_calibrated_at    timestamptz
);

create trigger foods_updated_at
  before update on foods
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- categories
-- ─────────────────────────────────────────────
create table categories (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name       text not null,
  kind       text not null,  -- 'activity'|'expense'|'meal_slot'|'other'
  unique (name, kind)
);

create trigger categories_updated_at
  before update on categories
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- targets
-- ─────────────────────────────────────────────
create table targets (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  day_type        text not null,  -- 'gym'|'rest'|'weekend'
  kcal_target     int,
  protein_target_g int,
  notes           text
);

create trigger targets_updated_at
  before update on targets
  for each row execute function update_updated_at();

-- Seed targets
insert into targets (day_type, kcal_target, protein_target_g) values
  ('gym',     2100, 140),
  ('rest',    1800, 130),
  ('weekend', 2300, 145);

-- ─────────────────────────────────────────────
-- weekly_reviews
-- ─────────────────────────────────────────────
create table weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  week_start_date date        not null,
  review_markdown text,
  data_snapshot   jsonb,
  model_used      text
);

create trigger weekly_reviews_updated_at
  before update on weekly_reviews
  for each row execute function update_updated_at();
