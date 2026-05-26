"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fetchEntries, deleteEntry, fetchTargets, getDayType } from "@/lib/api";
import type { Entry, MealData, WorkoutData, CardioData, SleepData, ExpenseData, WeightData } from "@/lib/types";
import WeightForm from "./forms/WeightForm";
import MealForm from "./forms/MealForm";
import WorkoutForm from "./forms/WorkoutForm";
import SleepForm from "./forms/SleepForm";
import ExpenseForm from "./forms/ExpenseForm";

type Props = {
  refreshKey: number;
};

type Target = { day_type: string; kcal_target: number; protein_target_g: number };

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function formatTime(time: string | null) {
  if (!time) return "";
  return time.slice(0, 5);
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  onEdit: (e: Entry) => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  function summary() {
    switch (entry.type) {
      case "weight": {
        const d = entry.data as WeightData;
        return `${d.kg} kg`;
      }
      case "meal": {
        const d = entry.data as MealData;
        return `${d.name} (${d.slot}) · ${d.total_kcal} kcal · ${d.total_protein_g}g protein`;
      }
      case "workout": {
        const d = entry.data as WorkoutData;
        const setCount = d.sets?.length ?? 0;
        return `${d.exercise} · ${setCount} set${setCount !== 1 ? "s" : ""}${d.muscle_groups?.length ? " · " + d.muscle_groups.join(", ") : ""}`;
      }
      case "cardio": {
        const d = entry.data as CardioData;
        return `${d.activity} · ${d.duration_min} min${d.distance_km ? ` · ${d.distance_km} km` : ""}`;
      }
      case "sleep": {
        const d = entry.data as SleepData;
        return `${d.hours} hrs${d.quality ? ` · quality ${d.quality}/5` : ""}`;
      }
      case "expense": {
        const d = entry.data as ExpenseData;
        return `₹${d.amount_inr} · ${d.item} (${d.category})`;
      }
      default:
        return JSON.stringify(entry.data).slice(0, 60);
    }
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs text-muted-foreground w-10 shrink-0 pt-0.5">
        {formatTime(entry.entry_time)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize shrink-0">
            {entry.type}
          </Badge>
          <span className="text-sm truncate">{summary()}</span>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {!confirming ? (
          <>
            <button
              className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => onEdit(entry)}
              aria-label="Edit"
            >
              ✏️
            </button>
            <button
              className="text-xs text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setConfirming(true)}
              aria-label="Delete"
            >
              🗑️
            </button>
          </>
        ) : (
          <div className="flex gap-1 items-center">
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => onDelete(entry.id)}>
              Delete
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditModal({
  entry,
  onSaved,
  onCancel,
}: {
  entry: Entry;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const formProps = { editing: entry, onSaved, onCancelEdit: onCancel };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="font-semibold text-lg mb-4 capitalize">Edit {entry.type}</h2>
        {entry.type === "weight" && <WeightForm {...formProps} />}
        {entry.type === "meal" && <MealForm {...formProps} />}
        {entry.type === "workout" && <WorkoutForm {...formProps} />}
        {entry.type === "sleep" && <SleepForm {...formProps} />}
        {entry.type === "expense" && <ExpenseForm {...formProps} />}
        {!["weight", "meal", "workout", "sleep", "expense"].includes(entry.type) && (
          <p className="text-sm text-muted-foreground">No editor available for this entry type.</p>
        )}
      </div>
    </div>
  );
}

export default function TodayView({ refreshKey }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const [ents, tgts] = await Promise.all([
        fetchEntries(todayDate()),
        fetchTargets(),
      ]);
      if (!cancelled) {
        setEntries(ents);
        setTargets(tgts);
        setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [refreshKey, localRefresh]);

  async function handleDelete(id: string) {
    await deleteEntry(id);
    setLocalRefresh((k) => k + 1);
  }

  function handleEditSaved() {
    setEditingEntry(null);
    setLocalRefresh((k) => k + 1);
  }

  // ── Summary calculations ──────────────────────────────────────────────────
  const dayType = getDayType(new Date());
  const target = targets.find((t) => t.day_type === dayType);

  const totalKcal = entries
    .filter((e) => e.type === "meal")
    .reduce((s, e) => s + ((e.data as MealData).total_kcal ?? 0), 0);

  const totalProtein = entries
    .filter((e) => e.type === "meal")
    .reduce((s, e) => s + ((e.data as MealData).total_protein_g ?? 0), 0);

  const workoutCount = entries.filter((e) => e.type === "workout").length;

  const sleepHours = entries
    .filter((e) => e.type === "sleep")
    .reduce((s, e) => s + ((e.data as SleepData).hours ?? 0), 0);

  const totalSpend = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + ((e.data as ExpenseData).amount_inr ?? 0), 0);

  // ── Group entries by type ─────────────────────────────────────────────────
  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.type] ??= []).push(e);
    return acc;
  }, {});

  const typeOrder = ["weight", "meal", "workout", "cardio", "sleep", "expense", "note"];
  const orderedTypes = [
    ...typeOrder.filter((t) => grouped[t]),
    ...Object.keys(grouped).filter((t) => !typeOrder.includes(t)),
  ];

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading today…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base">
            Today —{" "}
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
            <span className="ml-2 text-xs font-normal text-muted-foreground capitalize">
              ({dayType} day)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SummaryItem
              label="Calories"
              value={`${Math.round(totalKcal)} kcal`}
              target={target ? `/ ${target.kcal_target}` : undefined}
              pct={target ? totalKcal / target.kcal_target : undefined}
            />
            <SummaryItem
              label="Protein"
              value={`${Math.round(totalProtein)}g`}
              target={target ? `/ ${target.protein_target_g}g` : undefined}
              pct={target ? totalProtein / target.protein_target_g : undefined}
            />
            <SummaryItem label="Workouts" value={String(workoutCount)} />
            <SummaryItem
              label="Sleep"
              value={sleepHours > 0 ? `${sleepHours}h` : "—"}
            />
            <SummaryItem
              label="Spend"
              value={totalSpend > 0 ? `₹${Math.round(totalSpend)}` : "—"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Entries by type */}
      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-6 text-sm">
          No entries yet today. Use the forms above to start tracking.
        </p>
      ) : (
        <Card>
          <CardContent className="px-4 py-3">
            {orderedTypes.map((type, ti) => (
              <div key={type}>
                {ti > 0 && <Separator className="my-1" />}
                <div className="py-1">
                  {grouped[type].map((entry, ei) => (
                    <div key={entry.id}>
                      {ei > 0 && <Separator className="my-0.5 opacity-30" />}
                      <EntryRow
                        entry={entry}
                        onEdit={setEditingEntry}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {editingEntry && (
        <EditModal
          entry={editingEntry}
          onSaved={handleEditSaved}
          onCancel={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  target,
  pct,
}: {
  label: string;
  value: string;
  target?: string;
  pct?: number;
}) {
  const color =
    pct === undefined
      ? ""
      : pct >= 0.9 && pct <= 1.1
      ? "text-green-600"
      : pct > 1.1
      ? "text-orange-500"
      : "text-foreground";

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {value}
        {target && (
          <span className="font-normal text-muted-foreground ml-1">{target}</span>
        )}
      </span>
      {pct !== undefined && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct > 1.05 ? "bg-orange-400" : "bg-primary"
            }`}
            style={{ width: `${Math.min(pct * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
