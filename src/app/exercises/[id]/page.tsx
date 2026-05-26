import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ExerciseProgressionChart, { type ChartPoint } from "@/components/ExerciseProgressionChart";

export const revalidate = 0;

// ─── Types ────────────────────────────────────────────────────────────────────

type SetData = {
  reps: number;
  weight_kg: number | null;
  notes?: string;
};

type WorkoutEntryData = {
  exercise: string;
  sets: SetData[];
  muscle_groups: string[];
};

type WorkoutEntry = {
  id: string;
  entry_date: string;
  data: WorkoutEntryData;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Group sets like [{8,60},{8,60},{6,60}] → "2×8 @ 60 kg, 1×6 @ 60 kg" */
function formatSets(sets: SetData[], isBodyweight: boolean): string {
  if (!sets.length) return "—";

  // Group consecutive sets with same reps+weight
  const groups: { reps: number; weight: number | null; count: number }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.reps === s.reps && last.weight === s.weight_kg) {
      last.count++;
    } else {
      groups.push({ reps: s.reps, weight: s.weight_kg, count: 1 });
    }
  }

  return groups
    .map(({ reps, weight, count }) => {
      const base = `${count}×${reps}`;
      if (isBodyweight || weight === null) return `${base} BW`;
      return `${base} @ ${weight} kg`;
    })
    .join(", ");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ExerciseProgressionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();

  // 1. Fetch exercise metadata
  const { data: exercise, error: exErr } = await supabase
    .from("exercises")
    .select("id, name, muscle_groups, default_unit")
    .eq("id", id)
    .single();

  if (exErr || !exercise) notFound();

  // 2. Fetch all workout entries for this exercise name
  const { data: rawEntries } = await supabase
    .from("entries")
    .select("id, entry_date, data")
    .eq("type", "workout")
    .filter("data->>exercise", "eq", exercise.name)
    .order("entry_date", { ascending: true });

  const entries: WorkoutEntry[] = (rawEntries ?? []).map((e) => ({
    id: e.id,
    entry_date: e.entry_date,
    data: e.data as WorkoutEntryData,
  }));

  if (entries.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <ExerciseHeader name={exercise.name} muscleGroups={exercise.muscle_groups} />
        <main className="max-w-2xl mx-auto px-4 py-4">
          <p className="text-center text-muted-foreground py-12">No sessions logged yet.</p>
        </main>
      </div>
    );
  }

  // 3. Determine if bodyweight
  const allSets = entries.flatMap((e) => e.data.sets);
  const isBodyweight =
    exercise.default_unit === "bw" || allSets.every((s) => s.weight_kg === null);

  // 4. Compute stats
  const totalSessions = entries.length;
  const lastPerformed = entries[entries.length - 1].entry_date;

  let bestSet: SetData | null = null;
  let best1rm = 0;

  for (const s of allSets) {
    if (isBodyweight) {
      if (!bestSet || s.reps > bestSet.reps) bestSet = s;
    } else if (s.weight_kg !== null) {
      const e1rm = epley(s.weight_kg, s.reps);
      if (e1rm > best1rm) {
        best1rm = e1rm;
        bestSet = s;
      }
    }
  }

  const bestSetLabel = !bestSet
    ? "—"
    : isBodyweight
    ? `${bestSet.reps} reps`
    : `${bestSet.weight_kg} kg × ${bestSet.reps} reps`;

  const best1rmLabel =
    isBodyweight || best1rm === 0 ? null : `${Math.round(best1rm * 10) / 10} kg`;

  // 5. Build chart points (one per date, deduplicated by max values)
  const byDate = new Map<string, { topWeight: number | null; epley1rm: number | null; maxReps: number }>();

  for (const entry of entries) {
    const date = entry.entry_date;
    const prev = byDate.get(date) ?? { topWeight: null, epley1rm: null, maxReps: 0 };

    let topWeight = prev.topWeight;
    let e1rm = prev.epley1rm;
    let maxReps = prev.maxReps;

    for (const s of entry.data.sets) {
      maxReps = Math.max(maxReps, s.reps);
      if (s.weight_kg !== null) {
        topWeight = Math.max(topWeight ?? 0, s.weight_kg);
        e1rm = Math.max(e1rm ?? 0, epley(s.weight_kg, s.reps));
      }
    }

    byDate.set(date, { topWeight, epley1rm: e1rm, maxReps });
  }

  const chartPoints: ChartPoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { topWeight, epley1rm, maxReps }]) => ({
      date,
      topWeight,
      epley1rm: epley1rm !== null ? Math.round(epley1rm * 10) / 10 : null,
      maxReps,
    }));

  // 6. Sessions list (reverse chronological for the table)
  const sessions = [...entries].reverse();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30">
      <ExerciseHeader name={exercise.name} muscleGroups={exercise.muscle_groups} />

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Sessions" value={String(totalSessions)} />
          <StatCard label="Last performed" value={fmtDate(lastPerformed)} small />
          <StatCard label="Best set" value={bestSetLabel} />
          {best1rmLabel && <StatCard label="Est. 1RM" value={best1rmLabel} />}
        </div>

        {/* Progression chart */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">
              {isBodyweight ? "Reps over time" : "Weight & estimated 1RM over time"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ExerciseProgressionChart points={chartPoints} isBodyweight={isBodyweight} />
          </CardContent>
        </Card>

        {/* Session table */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">All sessions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Sets</th>
                    <th className="pb-2 pr-4 font-medium">
                      {isBodyweight ? "Max reps" : "Top set"}
                    </th>
                    {!isBodyweight && <th className="pb-2 font-medium">Est. 1RM</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessions.map((entry) => {
                    const topSet = getTopSet(entry.data.sets, isBodyweight);
                    const sessionE1rm = getSessionE1rm(entry.data.sets);
                    const notes = entry.data.sets
                      .map((s) => s.notes)
                      .filter(Boolean)
                      .join("; ");
                    return (
                      <tr key={entry.id} className="align-top">
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                          {fmtDate(entry.entry_date)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span>{formatSets(entry.data.sets, isBodyweight)}</span>
                          {notes && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {notes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">
                          {topSet ?? "—"}
                        </td>
                        {!isBodyweight && (
                          <td className="py-2.5 tabular-nums text-muted-foreground">
                            {sessionE1rm !== null ? `${sessionE1rm} kg` : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="sm:hidden space-y-3">
              {sessions.map((entry) => {
                const topSet = getTopSet(entry.data.sets, isBodyweight);
                const sessionE1rm = getSessionE1rm(entry.data.sets);
                const notes = entry.data.sets
                  .map((s) => s.notes)
                  .filter(Boolean)
                  .join("; ");
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border bg-card p-3 space-y-1.5"
                  >
                    <p className="text-xs text-muted-foreground font-medium">
                      {fmtDate(entry.entry_date)}
                    </p>
                    <p className="text-sm">{formatSets(entry.data.sets, isBodyweight)}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {topSet && (
                        <span>
                          <span className="font-medium text-foreground">{topSet}</span>{" "}
                          {isBodyweight ? "max reps" : "top set"}
                        </span>
                      )}
                      {sessionE1rm !== null && (
                        <span>
                          <span className="font-medium text-foreground">{sessionE1rm} kg</span>{" "}
                          est. 1RM
                        </span>
                      )}
                    </div>
                    {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExerciseHeader({
  name,
  muscleGroups,
}: {
  name: string;
  muscleGroups: string[] | null;
}) {
  return (
    <header className="bg-background border-b sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/exercises"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ← Exercises
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-lg tracking-tight truncate">{name}</h1>
            {muscleGroups && muscleGroups.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {muscleGroups.map((m) => (
                  <Badge key={m} variant="secondary" className="text-xs px-1.5 py-0">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`font-semibold ${small ? "text-xs leading-snug" : "text-sm"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getTopSet(sets: SetData[], isBodyweight: boolean): string | null {
  if (!sets.length) return null;
  if (isBodyweight) {
    const max = Math.max(...sets.map((s) => s.reps));
    return `${max} reps`;
  }
  // Highest weight set
  const best = sets
    .filter((s) => s.weight_kg !== null)
    .sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0))[0];
  if (!best) return null;
  return `${best.weight_kg} kg × ${best.reps}`;
}

function getSessionE1rm(sets: SetData[]): number | null {
  let max = 0;
  for (const s of sets) {
    if (s.weight_kg !== null) {
      const e = epley(s.weight_kg, s.reps);
      if (e > max) max = e;
    }
  }
  return max > 0 ? Math.round(max * 10) / 10 : null;
}
