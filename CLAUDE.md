# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Next.js Turbopack, localhost:3000)
npm run build     # production build
npm run lint      # ESLint
```

There are no automated tests. Verify changes manually with `npm run dev`.

## Architecture

Next.js 16 App Router app backed by Supabase (Postgres) and Anthropic Claude Haiku 4.5. All database access is server-side via the service-role client (`src/lib/supabase/server.ts`), which bypasses Supabase RLS. The browser never touches Supabase directly.

### Data model

All tracked events live in a single polymorphic `entries` table with a `type` text field and a `data` JSONB column. The TypeScript discriminated union in `src/lib/types.ts` describes the exact shape of `data` for each type: `weight`, `meal`, `workout`, `cardio`, `sleep`, `expense`, `note`.

Supporting tables:
- `foods`, `exercises`, `categories` — lookup/reference data auto-populated by the parser
- `targets` — day-type nutrition targets (gym / rest / weekend); edit in Supabase Table Editor
- `streaks` — precomputed habit counters; recomputed by `POST /api/streaks` (should be called after new entries are saved)
- `goals` — user goals; soft-deleted via `is_active = false`
- `weekly_reviews` — stored AI-generated markdown reviews; upserted on regeneration

### Day-type logic

Mon/Wed/Fri = `gym`, Tue/Thu = `rest`, Sat/Sun = `weekend`. This mapping lives in `src/lib/api.ts` (`getDayType`) and is duplicated in several API routes and server actions. It drives calorie targets and streak qualification.

### AI parse flow

1. User types free-text into `DumpDayBox` → POST to `/api/parse`
2. Route fetches known foods/exercises/categories from DB, calls `buildParserPrompt()` (`src/lib/parser/prompt.ts`) which returns a `{ static, dynamic }` split
3. The static block is sent with `cache_control: { type: "ephemeral" }` so it's cached by Anthropic after the first call (~90% cheaper on repeat calls); the dynamic block (today's date + known items) is uncached
4. Raw JSON response is validated with the Zod schema in `src/lib/parser/schema.ts`
5. `ParsePreviewModal` shows the parsed entries for review
6. On confirm, POST to `/api/parse/save` saves entries and upserts any new foods/exercises/categories discovered

### Weekly review flow

`/review/actions.ts` contains Next.js Server Actions (`generateWeeklyReview`, `fetchPastReviews`). Generation aggregates a week of entries into a structured text prompt (no Zod validation — returns raw markdown), calls Haiku, then upserts to `weekly_reviews`.

### Insights

`GET /api/insights` is fully deterministic (no LLM). It scans the last 14 days of entries and computes up to 3 insights: protein shortfalls on rest days, sleep trend vs. prior week, spend trend vs. prior week, and lift 1RM PRs (Epley formula). Results are cached in-memory for 1 hour keyed by date.

### Client/server boundary

- `src/lib/api.ts` — all client-side fetch helpers (used by form components and `TodayView`)
- `src/lib/supabase/server.ts` — server-only Supabase client (service_role key)
- `src/app/review/actions.ts` — `"use server"` Server Actions (called directly from page components, no API route needed)
- API routes under `src/app/api/` are used for everything else (entries CRUD, parse, insights, streaks, goals)

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-side anon key (unused in code currently, but required by Supabase JS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side service role key — all DB access uses this |
| `ANTHROPIC_API_KEY` | Used by `/api/parse` and `review/actions.ts` |

Database schema is in `supabase/schema.sql` — apply it by pasting into the Supabase SQL Editor.
