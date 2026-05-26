"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import type {
  MealData,
  WorkoutData,
  CardioData,
  SleepData,
  ExpenseData,
  WeightData,
} from "@/lib/types";

// ─── Shared type ──────────────────────────────────────────────────────────────

export type WeeklyReview = {
  id: string;
  week_start_date: string;
  review_markdown: string | null;
  model_used: string | null;
  created_at: string;
};

// ─── Fetch past reviews ───────────────────────────────────────────────────────

export async function fetchPastReviews(): Promise<WeeklyReview[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("weekly_reviews")
    .select("id, week_start_date, review_markdown, model_used, created_at")
    .order("week_start_date", { ascending: false })
    .limit(12);
  return (data as WeeklyReview[]) ?? [];
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getDayType(dateStr: string): "gym" | "rest" | "weekend" {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  if (dow === 0 || dow === 6) return "weekend";
  if (dow === 1 || dow === 3 || dow === 5) return "gym";
  return "rest";
}

type Entry = { entry_date: string; type: string; data: Record<string, unknown> };
type TargetRow = { day_type: string; kcal_target: number | null; protein_target_g: number | null };

function buildReviewPrompt(
  entries: Entry[],
  targets: TargetRow[],
  weekStart: string,
  weekEnd: string
): string {
  // Generate Mon–Sun date strings
  const allDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    allDates.push(d.toISOString().split("T")[0]);
  }

  type DayBucket = {
    weight: number | null;
    kcal: number;
    protein: number;
    sleep: number | null;
    workouts: string[];
    cardio: string[];
    expenses: Record<string, number>;
    muscles: Record<string, number>; // group → total sets
  };

  const byDay: Record<string, DayBucket> = {};
  for (const d of allDates) {
    byDay[d] = { weight: null, kcal: 0, protein: 0, sleep: null, workouts: [], cardio: [], expenses: {}, muscles: {} };
  }

  for (const e of entries) {
    const day = byDay[e.entry_date];
    if (!day) continue;
    switch (e.type) {
      case "weight": {
        const d = e.data as WeightData;
        day.weight = d.kg;
        break;
      }
      case "meal": {
        const d = e.data as MealData;
        day.kcal += d.total_kcal ?? 0;
        day.protein += d.total_protein_g ?? 0;
        break;
      }
      case "workout": {
        const d = e.data as WorkoutData;
        const n = d.sets?.length ?? 0;
        const str = d.sets
          ?.map((s) => `${s.reps}r${s.weight_kg != null ? `@${s.weight_kg}kg` : ""}`)
          .join(", ");
        day.workouts.push(`${d.exercise} (${n}×: ${str})`);
        for (const mg of d.muscle_groups ?? []) {
          day.muscles[mg] = (day.muscles[mg] ?? 0) + n;
        }
        break;
      }
      case "cardio": {
        const d = e.data as CardioData;
        day.cardio.push(`${d.activity} ${d.duration_min}min${d.intensity ? ` (${d.intensity})` : ""}`);
        break;
      }
      case "sleep": {
        const d = e.data as SleepData;
        day.sleep = (day.sleep ?? 0) + d.hours;
        break;
      }
      case "expense": {
        const d = e.data as ExpenseData;
        day.expenses[d.category] = (day.expenses[d.category] ?? 0) + d.amount_inr;
        break;
      }
    }
  }

  // Aggregate weekly totals while building day lines
  let totalKcal = 0, totalProtein = 0, targetKcal = 0, targetProtein = 0, workoutDays = 0;
  const weekMuscles: Record<string, number> = {};
  const weekExpenses: Record<string, number> = {};

  const dayLines = allDates.map((date) => {
    const day = byDay[date];
    const dayType = getDayType(date);
    const tgt = targets.find((t) => t.day_type === dayType);
    const kcalT = tgt?.kcal_target ?? null;
    const protT = tgt?.protein_target_g ?? null;

    totalKcal += day.kcal;
    totalProtein += day.protein;
    if (kcalT) targetKcal += kcalT;
    if (protT) targetProtein += protT;
    if (day.workouts.length > 0) workoutDays++;
    for (const [mg, sets] of Object.entries(day.muscles))
      weekMuscles[mg] = (weekMuscles[mg] ?? 0) + sets;
    for (const [cat, amt] of Object.entries(day.expenses))
      weekExpenses[cat] = (weekExpenses[cat] ?? 0) + amt;

    const label = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "short",
    });

    const parts: string[] = [];
    if (day.weight !== null) parts.push(`Weight: ${day.weight} kg`);
    if (day.kcal > 0)
      parts.push(`Calories: ${Math.round(day.kcal)} kcal${kcalT ? ` / target ${kcalT}` : ""}`);
    if (day.protein > 0)
      parts.push(`Protein: ${Math.round(day.protein)}g${protT ? ` / target ${protT}g` : ""}`);
    if (day.sleep !== null) parts.push(`Sleep: ${day.sleep}h`);
    if (day.workouts.length > 0) parts.push(`Workouts: ${day.workouts.join("; ")}`);
    if (day.cardio.length > 0) parts.push(`Cardio: ${day.cardio.join("; ")}`);
    const expParts = Object.entries(day.expenses).map(([k, v]) => `${k} ₹${Math.round(v)}`);
    if (expParts.length > 0)
      parts.push(`Expenses: ${expParts.join(", ")} = ₹${Math.round(Object.values(day.expenses).reduce((s, v) => s + v, 0))}`);
    if (parts.length === 0) parts.push("(no data logged)");

    return `**${label}** (${dayType})\n${parts.map((p) => `- ${p}`).join("\n")}`;
  });

  const muscleStr = Object.entries(weekMuscles)
    .sort(([, a], [, b]) => b - a)
    .map(([mg, sets]) => `${mg}: ${sets} sets`)
    .join(", ");

  const expStr = Object.entries(weekExpenses).map(([k, v]) => `${k}: ₹${Math.round(v)}`).join(", ");
  const totalExp = Math.round(Object.values(weekExpenses).reduce((s, v) => s + v, 0));

  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return `You are a personal fitness and life coach reviewing a week of tracking data. Be direct, specific, and data-driven — no generic advice.

**Week: ${fmt(weekStart)} – ${fmt(weekEnd)}**

## Daily Log

${dayLines.join("\n\n")}

## Weekly Totals
- Calories: ${Math.round(totalKcal)} kcal${targetKcal > 0 ? ` / ${targetKcal} target` : ""}
- Protein: ${Math.round(totalProtein)}g${targetProtein > 0 ? ` / ${targetProtein}g target` : ""}
- Workout days: ${workoutDays} / 7
${muscleStr ? `- Muscle volume: ${muscleStr}` : ""}
${expStr ? `- Expenses: ₹${totalExp} total (${expStr})` : ""}

## Your Task

Return a weekly review in exactly this markdown format. Be honest and specific to the numbers — do not pad with generic fitness advice. Keep it under 350 words.

## Grade
[A / B / C / D / F] — [one-sentence rationale tied to the data]

## What Went Well
- [specific positive with numbers]
- [specific positive]

## What Slipped
- [specific shortfall with numbers]
- [specific shortfall]

## 3 Actions for Next Week
1. [specific, measurable action]
2. [specific, measurable action]
3. [specific, measurable action]

## Watch Out
[One pattern in the data that could become a problem if not corrected]`;
}

// ─── Generate review server action ────────────────────────────────────────────

export async function generateWeeklyReview(
  weekStart: string
): Promise<{ review: WeeklyReview | null; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    return { review: null, error: "ANTHROPIC_API_KEY is not configured" };
  }

  const weekEnd = (() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().split("T")[0];
  })();

  const supabase = createServerClient();
  const [entriesRes, targetsRes] = await Promise.all([
    supabase
      .from("entries")
      .select("entry_date, type, data")
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd)
      .order("entry_date", { ascending: true }),
    supabase.from("targets").select("day_type, kcal_target, protein_target_g"),
  ]);

  const entries = (entriesRes.data ?? []) as Entry[];
  const targets = (targetsRes.data ?? []) as TargetRow[];

  const prompt = buildReviewPrompt(entries, targets, weekStart, weekEnd);

  const anthropic = new Anthropic({ apiKey });
  let markdown: string;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type from Anthropic");
    markdown = block.text;
  } catch (err) {
    return {
      review: null,
      error: `Anthropic API error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const model = "claude-haiku-4-5-20251001";
  const snapshot = { entries_count: entries.length, week_start: weekStart, week_end: weekEnd };

  // Check for an existing review for this week, then insert or update
  const { data: existing } = await supabase
    .from("weekly_reviews")
    .select("id")
    .eq("week_start_date", weekStart)
    .maybeSingle();

  let saved: WeeklyReview | null = null;
  if (existing) {
    const { data, error } = await supabase
      .from("weekly_reviews")
      .update({ review_markdown: markdown, model_used: model, data_snapshot: snapshot })
      .eq("id", existing.id)
      .select("id, week_start_date, review_markdown, model_used, created_at")
      .single();
    if (error) return { review: null, error: error.message };
    saved = data as WeeklyReview;
  } else {
    const { data, error } = await supabase
      .from("weekly_reviews")
      .insert({ week_start_date: weekStart, review_markdown: markdown, model_used: model, data_snapshot: snapshot })
      .select("id, week_start_date, review_markdown, model_used, created_at")
      .single();
    if (error) return { review: null, error: error.message };
    saved = data as WeeklyReview;
  }

  return { review: saved };
}
