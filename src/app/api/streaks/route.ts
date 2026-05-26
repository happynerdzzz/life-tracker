import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export type StreakRow = {
  habit_key: string;
  current_streak: number;
  longest_streak: number;
  last_qualified: string | null;
  updated_at: string;
};

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("streaks")
    .select("habit_key, current_streak, longest_streak, last_qualified, updated_at")
    .order("habit_key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ─── Recompute logic ──────────────────────────────────────────────────────────

type EntryRow = { entry_date: string; type: string; data: Record<string, unknown> };
type TargetRow = { day_type: string; kcal_target: number | null };

function getDayType(date: string): "gym" | "rest" | "weekend" {
  const dow = new Date(date + "T00:00:00").getDay();
  if (dow === 0 || dow === 6) return "weekend";
  if (dow === 1 || dow === 3 || dow === 5) return "gym";
  return "rest";
}

function buildDateRange(days: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().split("T")[0]);
  }
  return result;
}

function calcStreak(
  dates: string[],
  dateSet: Set<string>,
  skipFn?: (date: string) => boolean
): { current: number; longest: number; lastQualified: string | null } {
  let current = 0;
  let longest = 0;
  let run = 0;
  let lastQualified: string | null = null;

  for (const date of dates) {
    if (skipFn?.(date)) {
      // gym-day streak: skip non-gym days without breaking
      if (run > 0 && !lastQualified) lastQualified = date;
      continue;
    }
    if (dateSet.has(date)) {
      run++;
      if (!lastQualified) lastQualified = date;
      if (run > longest) longest = run;
    } else {
      if (run > 0 && current === 0) current = run;
      run = 0;
    }
  }
  if (current === 0) current = run;
  if (run > longest) longest = run;
  return { current, longest, lastQualified };
}

export async function POST() {
  const supabase = createServerClient();
  const dates = buildDateRange(60);
  const oldest = dates[dates.length - 1];

  const [entriesRes, targetsRes] = await Promise.all([
    supabase
      .from("entries")
      .select("entry_date, type, data")
      .gte("entry_date", oldest)
      .order("entry_date", { ascending: false }),
    supabase.from("targets").select("day_type, kcal_target"),
  ]);

  const entries: EntryRow[] = (entriesRes.data ?? []) as EntryRow[];
  const targets: TargetRow[] = (targetsRes.data ?? []) as TargetRow[];

  // Build per-date lookup sets
  const logAnything = new Set(entries.map((e) => e.entry_date));
  const mealLogged = new Set(entries.filter((e) => e.type === "meal").map((e) => e.entry_date));
  const sleepLogged = new Set(entries.filter((e) => e.type === "sleep").map((e) => e.entry_date));

  // workout_on_gym_day: Mon/Wed/Fri only
  const workoutDates = new Set(entries.filter((e) => e.type === "workout").map((e) => e.entry_date));

  // within_kcal_target
  const kcalByDate = new Map<string, number>();
  entries.filter((e) => e.type === "meal").forEach((e) => {
    const d = e.data as { total_kcal?: number };
    kcalByDate.set(e.entry_date, (kcalByDate.get(e.entry_date) ?? 0) + (d.total_kcal ?? 0));
  });
  const withinKcal = new Set<string>();
  for (const [date, kcal] of kcalByDate.entries()) {
    const t = targets.find((x) => x.day_type === getDayType(date));
    const target = t?.kcal_target ?? null;
    if (target && Math.abs(kcal - target) / target <= 0.1) withinKcal.add(date);
  }

  const habits: Array<{ key: string; set: Set<string>; skipFn?: (d: string) => boolean }> = [
    { key: "log_anything", set: logAnything },
    { key: "meal_logged", set: mealLogged },
    { key: "sleep_logged", set: sleepLogged },
    { key: "within_kcal_target", set: withinKcal },
    {
      key: "workout_on_gym_day",
      set: workoutDates,
      skipFn: (d: string) => getDayType(d) !== "gym",
    },
  ];

  const now = new Date().toISOString();
  for (const habit of habits) {
    const { current, longest, lastQualified } = calcStreak(dates, habit.set, habit.skipFn);
    await supabase.from("streaks").upsert(
      {
        habit_key: habit.key,
        current_streak: current,
        longest_streak: longest,
        last_qualified: lastQualified,
        updated_at: now,
      },
      { onConflict: "habit_key" }
    );
  }

  return NextResponse.json({ ok: true });
}
