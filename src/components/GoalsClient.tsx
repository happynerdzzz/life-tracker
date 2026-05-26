"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SectionHeader } from "@/components/ui/section-header";
import type { GoalRow } from "@/app/api/goals/route";

type WorkoutEntry = { entry_date: string; data: Record<string, unknown> };
type WorkoutData = { exercise: string; sets?: { reps: number; weight_kg: number | null }[] };

type PR = {
  exercise: string;
  best1rm: number | null;
  bestWeight: number | null;
  bestReps: number | null;
  lastDate: string;
  exerciseId?: string;
};

function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

function derivePRs(workoutEntries: WorkoutEntry[]): PR[] {
  const map = new Map<string, PR>();

  for (const entry of workoutEntries) {
    const d = entry.data as WorkoutData;
    if (!d.exercise) continue;

    const existing = map.get(d.exercise) ?? {
      exercise: d.exercise,
      best1rm: null,
      bestWeight: null,
      bestReps: null,
      lastDate: entry.entry_date,
    };

    for (const set of d.sets ?? []) {
      if (set.weight_kg !== null && set.weight_kg > 0) {
        const rm = epley(set.weight_kg, set.reps);
        if (existing.best1rm === null || rm > existing.best1rm) existing.best1rm = Math.round(rm * 10) / 10;
        if (existing.bestWeight === null || set.weight_kg > existing.bestWeight) {
          existing.bestWeight = set.weight_kg;
          existing.bestReps = set.reps;
        }
      } else {
        if (existing.bestReps === null || set.reps > existing.bestReps) existing.bestReps = set.reps;
      }
    }

    if (!map.has(d.exercise) || entry.entry_date > existing.lastDate) {
      existing.lastDate = entry.entry_date;
    }

    map.set(d.exercise, existing);
  }

  return Array.from(map.values())
    .filter((pr) => pr.best1rm !== null || pr.bestReps !== null)
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

function goalProgress(goal: GoalRow, latestWeight: number | null): number | null {
  if (goal.kind === "weight" && latestWeight !== null && goal.start_value !== null) {
    const start = goal.start_value;
    const target = goal.target_value;
    const current = latestWeight;
    if (start === target) return 1;
    return Math.max(0, Math.min(1, (start - current) / (start - target)));
  }
  return null;
}

function daysRemaining(targetDate: string | null): number | null {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Goal form ────────────────────────────────────────────────────────────────

type GoalFormData = {
  kind: string;
  title: string;
  target_value: string;
  target_unit: string;
  target_date: string;
  reference: string;
  start_value: string;
};

const EMPTY_FORM: GoalFormData = { kind: "custom", title: "", target_value: "", target_unit: "", target_date: "", reference: "", start_value: "" };

function GoalForm({ initial, onSave, onCancel }: { initial?: GoalFormData; onSave: (d: GoalFormData) => void; onCancel: () => void }) {
  const [form, setForm] = useState<GoalFormData>(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function set(k: keyof GoalFormData, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.target_value) return;
    setSaving(true);
    onSave(form);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kind</label>
        <select
          value={form.kind}
          onChange={(e) => set("kind", e.target.value)}
          className="h-11 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="weight">Body weight</option>
          <option value="lift">Lift / 1RM</option>
          <option value="savings">Savings / spend</option>
          <option value="protein_avg">Avg protein</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</label>
        <input
          className="h-11 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
          placeholder="Get to 75 kg, Squat 120 kg 1RM…"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target value</label>
          <input
            type="number"
            className="h-11 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-primary/30"
            placeholder="75"
            value={form.target_value}
            onChange={(e) => set("target_value", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unit</label>
          <input
            className="h-11 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            placeholder="kg, ₹, g…"
            value={form.target_unit}
            onChange={(e) => set("target_unit", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start value</label>
          <input
            type="number"
            className="h-11 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            placeholder="Optional"
            value={form.start_value}
            onChange={(e) => set("start_value", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target date</label>
          <input
            type="date"
            className="h-11 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-primary/30"
            value={form.target_date}
            onChange={(e) => set("target_date", e.target.value)}
          />
        </div>
      </div>
      {(form.kind === "lift") && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Exercise name</label>
          <input
            className="h-11 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            placeholder="Bench press, Squat…"
            value={form.reference}
            onChange={(e) => set("reference", e.target.value)}
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button className="flex-1 h-11" onClick={handleSave} disabled={saving || !form.title.trim() || !form.target_value}>
          {saving ? "Saving…" : "Save goal"}
        </Button>
        <Button variant="ghost" className="h-11" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, latestWeight, onDelete }: { goal: GoalRow; latestWeight: number | null; onDelete: (id: string) => void }) {
  const pct = goalProgress(goal, latestWeight);
  const days = daysRemaining(goal.target_date);

  const displayPct = pct !== null ? Math.round(pct * 100) : null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.04)] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide capitalize">{goal.kind}</p>
          <p className="font-semibold text-sm mt-0.5 leading-snug">{goal.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDelete(goal.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Delete goal"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <span className="font-mono tabular-nums text-3xl font-semibold leading-none">
            {goal.kind === "weight" && latestWeight !== null ? latestWeight : "—"}
          </span>
          {goal.target_unit && <span className="text-sm text-muted-foreground ml-1">{goal.target_unit}</span>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="font-mono tabular-nums font-semibold">{goal.target_value} {goal.target_unit}</p>
        </div>
      </div>

      {pct !== null && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(displayPct ?? 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{displayPct}% there</span>
            {days !== null && (
              <span>{days > 0 ? `${days} days left` : days === 0 ? "Due today" : "Overdue"}</span>
            )}
          </div>
        </div>
      )}

      {pct === null && days !== null && (
        <p className="text-[11px] text-muted-foreground">
          {goal.target_date && `Due ${fmtDate(goal.target_date)}`}
          {days > 0 ? ` · ${days} days left` : days === 0 ? " · Due today" : " · Overdue"}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  goals: GoalRow[];
  workoutEntries: WorkoutEntry[];
  latestWeight: number | null;
};

export default function GoalsClient({ goals: initialGoals, workoutEntries, latestWeight }: Props) {
  const [goals, setGoals] = useState<GoalRow[]>(initialGoals);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState("");

  const prs = derivePRs(workoutEntries);

  async function handleSaveGoal(form: { kind: string; title: string; target_value: string; target_unit: string; target_date: string; reference: string; start_value: string }) {
    setError("");
    try {
      const body: Record<string, unknown> = {
        kind: form.kind,
        title: form.title.trim(),
        target_value: parseFloat(form.target_value),
        target_unit: form.target_unit.trim() || null,
        target_date: form.target_date || null,
        reference: form.reference.trim() || null,
        start_value: form.start_value ? parseFloat(form.start_value) : null,
      };
      const res = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      setGoals((prev) => [data as GoalRow, ...prev]);
      setSheetOpen(false);
    } catch {
      setError("Network error");
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Goals section */}
      <div className="space-y-3">
        <SectionHeader
          title="Active goals"
          action={
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-xs font-medium"
            >
              <Plus className="size-3.5" />
              New goal
            </button>
          }
        />

        {goals.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-center text-muted-foreground">
            <span className="text-4xl">🎯</span>
            <p className="text-sm">No active goals yet.</p>
            <Button onClick={() => setSheetOpen(true)} className="mt-1 h-9">Add your first goal</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} latestWeight={latestWeight} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* PRs section */}
      {prs.length > 0 && (
        <div className="space-y-3">
          <SectionHeader title="Personal records" />
          <Card>
            <CardContent className="px-0 py-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Exercise</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Est. 1RM</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Best set</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">When</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.map((pr) => (
                    <tr key={pr.exercise} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{pr.exercise}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm">
                        {pr.best1rm !== null ? `${pr.best1rm} kg` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs hidden sm:table-cell">
                        {pr.bestWeight !== null && pr.bestReps !== null
                          ? `${pr.bestReps}r @ ${pr.bestWeight} kg`
                          : pr.bestReps !== null ? `${pr.bestReps} reps BW` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs hidden sm:table-cell">
                        {new Date(pr.lastDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* New goal sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent title="New goal">
          <div className="px-5 pb-6 pt-3">
            <GoalForm onSave={handleSaveGoal} onCancel={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
