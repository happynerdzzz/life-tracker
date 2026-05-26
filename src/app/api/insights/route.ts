import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export type Insight = {
  id: string;
  severity: "positive" | "neutral" | "warning";
  title: string;
  detail: string;
};

// In-memory 1h cache keyed by date
const cache = new Map<string, { ts: number; data: Insight[] }>();

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

type EntryRow = { entry_date: string; type: string; data: Record<string, unknown> };
type TargetRow = { day_type: string; kcal_target: number | null; protein_target_g: number | null };

function getDayType(date: string): "gym" | "rest" | "weekend" {
  const dow = new Date(date + "T00:00:00").getDay();
  if (dow === 0 || dow === 6) return "weekend";
  if (dow === 1 || dow === 3 || dow === 5) return "gym";
  return "rest";
}

function computeInsights(entries: EntryRow[], targets: TargetRow[]): Insight[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function daysAgo(n: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  }

  const thisWeekStart = daysAgo(6);
  const twoWeeksStart = daysAgo(13);

  const last14 = entries.filter((e) => e.entry_date >= twoWeeksStart);

  // ── Protein on rest days ──────────────────────────────────────────────────
  const restDayMeals = last14.filter((e) => e.type === "meal" && getDayType(e.entry_date) === "rest");
  if (restDayMeals.length > 0) {
    const byDate = new Map<string, number>();
    restDayMeals.forEach((e) => {
      const d = e.data as { total_protein_g?: number };
      byDate.set(e.entry_date, (byDate.get(e.entry_date) ?? 0) + (d.total_protein_g ?? 0));
    });
    const avg = Array.from(byDate.values()).reduce((s, v) => s + v, 0) / byDate.size;
    const target = targets.find((t) => t.day_type === "rest")?.protein_target_g;
    if (target && avg < target) {
      const gap = Math.round(target - avg);
      return [{
        id: "protein_rest",
        severity: "warning",
        title: `${gap}g below protein target on rest days`,
        detail: `Averaging ${Math.round(avg)}g vs ${target}g target over last 14 days.`,
      }];
    }
  }

  const insights: Insight[] = [];

  // ── Sleep this week vs last week ──────────────────────────────────────────
  const sleepThisWeek = last14.filter((e) => e.type === "sleep" && e.entry_date >= thisWeekStart);
  const sleepLastWeek = last14.filter((e) => e.type === "sleep" && e.entry_date < thisWeekStart);
  if (sleepThisWeek.length >= 3 && sleepLastWeek.length >= 3) {
    const avgThis = sleepThisWeek.reduce((s, e) => s + ((e.data as { hours: number }).hours ?? 0), 0) / sleepThisWeek.length;
    const avgLast = sleepLastWeek.reduce((s, e) => s + ((e.data as { hours: number }).hours ?? 0), 0) / sleepLastWeek.length;
    const diff = avgThis - avgLast;
    if (Math.abs(diff) >= 0.5) {
      insights.push({
        id: "sleep_trend",
        severity: diff < 0 ? "warning" : "positive",
        title: `Sleep ${diff < 0 ? "dipped" : "improved"} to ${avgThis.toFixed(1)}h avg`,
        detail: `Was ${avgLast.toFixed(1)}h last week — ${Math.abs(diff).toFixed(1)}h ${diff < 0 ? "less" : "more"}.`,
      });
    }
  }

  // ── Spend vs 30-day avg ───────────────────────────────────────────────────
  const expenses = last14.filter((e) => e.type === "expense");
  const thisWeekSpend = expenses.filter((e) => e.entry_date >= thisWeekStart).reduce((s, e) => s + ((e.data as { amount_inr: number }).amount_inr ?? 0), 0);
  const lastWeekSpend = expenses.filter((e) => e.entry_date < thisWeekStart).reduce((s, e) => s + ((e.data as { amount_inr: number }).amount_inr ?? 0), 0);
  if (thisWeekSpend > 0 && lastWeekSpend > 0) {
    const pctDiff = ((thisWeekSpend - lastWeekSpend) / lastWeekSpend) * 100;
    if (Math.abs(pctDiff) >= 15) {
      insights.push({
        id: "spend_trend",
        severity: pctDiff > 0 ? "warning" : "positive",
        title: `Food spend ₹${Math.round(thisWeekSpend)} this week`,
        detail: `${Math.abs(Math.round(pctDiff))}% ${pctDiff > 0 ? "above" : "below"} last week (₹${Math.round(lastWeekSpend)}).`,
      });
    }
  }

  // ── Lift PR in last 14 days ───────────────────────────────────────────────
  const workouts = last14.filter((e) => e.type === "workout");
  if (workouts.length >= 4) {
    const epley = (w: number, r: number) => w * (1 + r / 30);
    const byExercise = new Map<string, { rm: number; entry_date: string }>();
    for (const e of workouts) {
      const d = e.data as { exercise?: string; sets?: { reps: number; weight_kg: number | null }[] };
      if (!d.exercise) continue;
      for (const set of d.sets ?? []) {
        if (!set.weight_kg) continue;
        const rm = epley(set.weight_kg, set.reps);
        const prev = byExercise.get(d.exercise);
        if (!prev || rm > prev.rm) byExercise.set(d.exercise, { rm, entry_date: e.entry_date });
      }
    }

    // Compare recent (last 7d) vs prior (7–14d)
    const recentRms = new Map<string, number>();
    const priorRms = new Map<string, number>();
    for (const e of workouts) {
      const d = e.data as { exercise?: string; sets?: { reps: number; weight_kg: number | null }[] };
      if (!d.exercise) continue;
      const isRecent = e.entry_date >= thisWeekStart;
      const target = isRecent ? recentRms : priorRms;
      for (const set of d.sets ?? []) {
        if (!set.weight_kg) continue;
        const rm = epley(set.weight_kg, set.reps);
        const prev = target.get(d.exercise) ?? 0;
        if (rm > prev) target.set(d.exercise, rm);
      }
    }

    for (const [ex, recentRm] of recentRms) {
      const priorRm = priorRms.get(ex);
      if (priorRm && recentRm > priorRm) {
        const gain = recentRm - priorRm;
        if (gain >= 2) {
          insights.push({
            id: `pr_${ex}`,
            severity: "positive",
            title: `${ex} 1RM up ${gain.toFixed(1)} kg`,
            detail: `${priorRm.toFixed(1)} kg → ${recentRm.toFixed(1)} kg est. 1RM this week.`,
          });
          break; // max one PR insight
        }
      }
    }
  }

  return insights.slice(0, 3);
}

export async function GET() {
  const key = todayKey();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < 3600_000) {
    return NextResponse.json(cached.data);
  }

  const supabase = createServerClient();
  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().split("T")[0]; })();

  const [entriesRes, targetsRes] = await Promise.all([
    supabase.from("entries").select("entry_date, type, data").gte("entry_date", cutoff).order("entry_date", { ascending: false }),
    supabase.from("targets").select("day_type, kcal_target, protein_target_g"),
  ]);

  const entries = (entriesRes.data ?? []) as EntryRow[];
  const targets = (targetsRes.data ?? []) as TargetRow[];

  const insights = computeInsights(entries, targets);

  cache.set(key, { ts: Date.now(), data: insights });
  // Prune old cache keys
  for (const k of cache.keys()) { if (k !== key) cache.delete(k); }

  return NextResponse.json(insights);
}
