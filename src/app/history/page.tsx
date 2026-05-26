import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import HistoryCharts from "@/components/HistoryCharts";
import type { HistoryEntry, HistoryTarget } from "@/components/HistoryCharts";

export const revalidate = 0;

export default async function HistoryPage() {
  const supabase = createServerClient();

  const [entriesRes, targetsRes] = await Promise.all([
    supabase
      .from("entries")
      .select("entry_date, type, data")
      .in("type", ["weight", "meal", "expense"])
      .order("entry_date", { ascending: true }),
    supabase.from("targets").select("day_type, kcal_target, protein_target_g"),
  ]);

  const entries: HistoryEntry[] = entriesRes.data ?? [];
  const targets: HistoryTarget[] = targetsRes.data ?? [];

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
          <h1 className="font-bold text-lg tracking-tight">History</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        <HistoryCharts entries={entries} targets={targets} />
      </main>
    </div>
  );
}
