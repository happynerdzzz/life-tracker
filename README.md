# Life Tracker

A personal fitness and life-tracking app. Log meals, workouts, weight, sleep, and expenses via free-text (AI-parsed) or quick-entry forms. View history charts, exercise progression, and AI-generated weekly reviews.

## Features

- **Today** — quick-entry forms + free-text dump parsed by Claude
- **History** — line/bar charts for weight, calories, protein, expenses
- **Exercises** — progression chart per exercise with estimated 1RM trend
- **Weekly Review** — AI-generated scorecard (grade, wins, slips, 3 actions)

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Server Actions)
- [Supabase](https://supabase.com/) (Postgres + JS client)
- [Anthropic Claude](https://anthropic.com/) (Haiku 4.5 — parsing + reviews)
- [Recharts](https://recharts.org/) for data visualisation
- [Tailwind CSS v4](https://tailwindcss.com/) + shadcn base-nova components

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [Anthropic API key](https://console.anthropic.com/)

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (**keep secret**) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |

### 3. Create the database schema

1. Open your Supabase project → **SQL Editor**
2. Copy the entire contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Paste into the editor and click **Run**

This creates all tables, indexes, triggers, and seeds the `targets` table.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create life-tracker --private --source=. --push
```

### 2. Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Select the `life-tracker` repo — Vercel auto-detects Next.js

### 3. Add environment variables

In **Vercel project → Settings → Environment Variables**, add all four variables for Production, Preview, and Development:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` |
| `ANTHROPIC_API_KEY` | `sk-ant-…` |

### 4. Deploy

Click **Deploy**. Subsequent pushes to `main` redeploy automatically.

## Project structure

```
src/
  app/
    page.tsx                 # Today — forms + entry list
    history/page.tsx         # Charts: weight, calories, protein, expenses
    exercises/
      page.tsx               # Exercise index (sorted by recent use)
      [id]/page.tsx          # Progression chart + session table
    review/
      page.tsx               # Weekly review page
      actions.ts             # Server actions: generate + fetch reviews
    api/
      entries/               # GET (by date), POST
      entries/[id]/          # PUT, DELETE
      exercises/             # GET, POST
      categories/            # GET, POST
      targets/               # GET
      parse/                 # POST — LLM text → structured entries
      parse/save/            # POST — save parsed entries + upsert new items
  components/
    TodayView.tsx
    HistoryCharts.tsx
    ExerciseProgressionChart.tsx
    WeeklyReviewClient.tsx
    DumpDayBox.tsx
    ParsePreviewModal.tsx
    FormCard.tsx
    forms/  WeightForm, MealForm, WorkoutForm, SleepForm, ExpenseForm
    ui/     button, card, badge, input, label, select, separator, tabs
  lib/
    api.ts                   # Client fetch helpers
    types.ts                 # Shared TypeScript types
    parser/prompt.ts         # LLM system prompt (static + dynamic blocks)
    parser/schema.ts         # Zod schema for parser output
    supabase/client.ts       # Browser Supabase client
    supabase/server.ts       # Server Supabase client (service_role)
supabase/
  schema.sql                 # Full DB schema — paste into Supabase SQL editor
```

## Day-type defaults

| Day | Type | kcal target | protein target |
|-----|------|-------------|----------------|
| Mon / Wed / Fri | Gym | 2100 kcal | 140 g |
| Tue / Thu | Rest | 1800 kcal | 130 g |
| Sat / Sun | Weekend | 2300 kcal | 145 g |

Edit these in Supabase → Table Editor → `targets`.
