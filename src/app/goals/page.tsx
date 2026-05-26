import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import GoalsClient from "@/components/GoalsClient";
import type { GoalRow } from "@/app/api/goals/route";

export const revalidate = 0;

export default async function GoalsPage() {
  const supabase = createServerClient();

  const [goalsRes, entriesRes, weightsRes] = await Promise.all([
    supabase
      .from("goals")
      .select("id, kind, title, target_value, target_unit, target_date, reference, start_value, is_active, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // workout entries for PR derivation
    supabase
      .from("entries")
      .select("entry_date, data")
      .eq("type", "workout")
      .order("entry_date", { ascending: false }),
    // latest weight for weight goals
    supabase
      .from("entries")
      .select("entry_date, data")
      .eq("type", "weight")
      .order("entry_date", { ascending: false })
      .limit(1),
  ]);

  const goals = (goalsRes.data ?? []) as GoalRow[];
  const workoutEntries = (entriesRes.data ?? []) as { entry_date: string; data: Record<string, unknown> }[];
  const latestWeight = (weightsRes.data?.[0]?.data as { kg?: number } | undefined)?.kg ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/60 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Today
            </Link>
            <h1 className="font-semibold text-lg tracking-tight">Goals & PRs</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        <GoalsClient goals={goals} workoutEntries={workoutEntries} latestWeight={latestWeight} />
      </main>
    </div>
  );
}
