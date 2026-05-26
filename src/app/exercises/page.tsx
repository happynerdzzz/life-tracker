import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0;

type ExerciseRow = {
  id: string;
  name: string;
  muscle_groups: string[] | null;
};

type WorkoutEntry = {
  entry_date: string;
  data: { exercise: string };
};

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ExercisesPage() {
  const supabase = createServerClient();

  const [exercisesRes, entriesRes] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, muscle_groups")
      .order("name"),
    supabase
      .from("entries")
      .select("entry_date, data")
      .eq("type", "workout")
      .order("entry_date", { ascending: false }),
  ]);

  const exercises: ExerciseRow[] = exercisesRes.data ?? [];
  const entries = (entriesRes.data ?? []) as WorkoutEntry[];

  // Group entries by exercise name → { lastDate, count }
  const statsByName = new Map<string, { lastDate: string; count: number }>();
  for (const e of entries) {
    const name: string = (e.data?.exercise as string) ?? "";
    if (!name) continue;
    const existing = statsByName.get(name);
    if (!existing) {
      statsByName.set(name, { lastDate: e.entry_date, count: 1 });
    } else {
      // entries are desc, first seen = most recent
      existing.count += 1;
    }
  }

  // Filter to exercises that have at least one entry, and attach stats
  type ExerciseWithStats = ExerciseRow & { lastDate: string; sessionCount: number };

  const active: ExerciseWithStats[] = exercises
    .flatMap((ex) => {
      const stats = statsByName.get(ex.name);
      if (!stats) return [];
      return [{ ...ex, lastDate: stats.lastDate, sessionCount: stats.count }];
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Today
          </Link>
          <h1 className="font-bold text-lg tracking-tight">Exercises</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <p className="text-muted-foreground">No workouts logged yet.</p>
            <p className="text-sm text-muted-foreground">
              Log a workout from the Today page to see progression here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((ex) => (
              <Link key={ex.id} href={`/exercises/${ex.id}`} className="block group">
                <Card className="transition-colors group-hover:bg-accent/50">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-sm truncate">{ex.name}</p>
                        {ex.muscle_groups && ex.muscle_groups.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ex.muscle_groups.map((m) => (
                              <Badge key={m} variant="secondary" className="text-xs px-1.5 py-0">
                                {m}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-xs text-muted-foreground">{fmtDate(ex.lastDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {ex.sessionCount} session{ex.sessionCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
