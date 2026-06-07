"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ring } from "@/components/ui/ring";
import { fetchEntries, deleteEntry, fetchTargets, getDayType, patchEntryDate } from "@/lib/api";
import { CATEGORY } from "@/lib/theme";
import type { Entry, MealData, WorkoutData, CardioData, SleepData, ExpenseData, WeightData } from "@/lib/types";
import StreakStrip from "./StreakStrip";
import InsightsCard from "./InsightsCard";
import WeightForm from "./forms/WeightForm";
import MealForm from "./forms/MealForm";
import WorkoutForm from "./forms/WorkoutForm";
import CardioForm from "./forms/CardioForm";
import SleepForm from "./forms/SleepForm";
import ExpenseForm from "./forms/ExpenseForm";

type Props = { refreshKey: number; logDate: string };
type Target = { day_type: string; kcal_target: number; protein_target_g: number; bmr_kcal?: number | null };

function formatTime(time: string | null) {
  if (!time) return "";
  return time.slice(0, 5);
}

function entrySummary(entry: Entry): string {
  switch (entry.type) {
    case "weight": {
      const d = entry.data as WeightData;
      return `${d.kg} kg`;
    }
    case "meal": {
      const d = entry.data as MealData;
      return `${d.name} · ${d.total_kcal} kcal · ${d.total_protein_g}g protein`;
    }
    case "workout": {
      const d = entry.data as WorkoutData;
      return `${d.exercise} · ${d.sets?.length ?? 0} sets${d.calories_burned ? ` · ${d.calories_burned} kcal` : ""}`;
    }
    case "cardio": {
      const d = entry.data as CardioData;
      return `${d.activity} · ${d.duration_min} min${d.calories_burned ? ` · ${d.calories_burned} kcal` : ""}`;
    }
    case "sleep": {
      const d = entry.data as SleepData;
      return `${d.hours}h sleep${d.quality ? ` · ${d.quality}/5` : ""}`;
    }
    case "expense": {
      const d = entry.data as ExpenseData;
      return `₹${d.amount_inr} · ${d.item}${d.split ? " · split" : ""}`;
    }
    default:
      return JSON.stringify(entry.data).slice(0, 50);
  }
}

function EditModal({ entry, onSaved, onCancel }: { entry: Entry; onSaved: () => void; onCancel: () => void }) {
  const [editDate, setEditDate] = useState(entry.entry_date);
  const [editTime, setEditTime] = useState(entry.entry_time ?? "");

  async function handleFormSaved() {
    const dateChanged = editDate !== entry.entry_date;
    const timeChanged = editTime !== (entry.entry_time ?? "");
    if (dateChanged || timeChanged) {
      await patchEntryDate(entry.id, editDate, editTime || null);
    }
    onSaved();
  }

  const formProps = { editing: entry, onSaved: handleFormSaved, onCancelEdit: onCancel };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="font-semibold text-lg mb-4 capitalize">Edit {entry.type}</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-muted/40 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Time <span className="text-muted-foreground font-normal text-xs">optional</span></label>
            <input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-muted/40 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
        </div>

        {entry.type === "weight" && <WeightForm {...formProps} />}
        {entry.type === "meal" && <MealForm {...formProps} />}
        {entry.type === "workout" && <WorkoutForm {...formProps} />}
        {entry.type === "cardio" && <CardioForm {...formProps} />}
        {entry.type === "sleep" && <SleepForm {...formProps} />}
        {entry.type === "expense" && <ExpenseForm {...formProps} />}
        {!["weight", "meal", "workout", "cardio", "sleep", "expense"].includes(entry.type) && (
          <p className="text-sm text-muted-foreground">No editor available for this entry type.</p>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ entry, onEdit, onDelete }: { entry: Entry; onEdit: (e: Entry) => void; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const cat = CATEGORY[entry.type as keyof typeof CATEGORY];
  const dotColor = cat?.hue ?? "var(--muted-foreground)";

  return (
    <div className="flex gap-3 group">
      {/* Left rail */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div
          className="size-2.5 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: dotColor }}
        />
        <div className="w-px flex-1 bg-border/60 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-3 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground shrink-0 pt-0.5 w-10">
            {formatTime(entry.entry_time)}
          </span>
          <div className="flex-1 min-w-0 bg-muted/40 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-medium capitalize shrink-0" style={{ color: dotColor }}>
                {cat?.label ?? entry.type}
              </span>
              <span className="text-xs text-muted-foreground truncate">{entrySummary(entry)}</span>
            </div>
          </div>

          {/* Actions — show on hover */}
          {!confirming ? (
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(entry)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Edit"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-1 shrink-0 items-center">
              <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => onDelete(entry.id)}>
                Delete
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Day-type pill ─────────────────────────────────────────────────────────────

const DAY_TYPE_STYLE = {
  gym:     { bg: "bg-[color-mix(in_oklch,var(--chart-3)_12%,transparent)]", text: "text-[oklch(0.50_0.22_30)]", label: "Gym day" },
  rest:    { bg: "bg-[color-mix(in_oklch,var(--chart-4)_12%,transparent)]", text: "text-[oklch(0.45_0.18_290)]", label: "Rest day" },
  weekend: { bg: "bg-[color-mix(in_oklch,var(--chart-2)_12%,transparent)]", text: "text-[oklch(0.48_0.18_145)]", label: "Weekend" },
} as const;

export default function TodayView({ refreshKey, logDate }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const [ents, tgts] = await Promise.all([fetchEntries(logDate), fetchTargets()]);
      if (!cancelled) { setEntries(ents); setTargets(tgts); setLoading(false); }
    }
    run();
    return () => { cancelled = true; };
  }, [refreshKey, localRefresh, logDate]);

  async function handleDelete(id: string) {
    await deleteEntry(id);
    setLocalRefresh((k) => k + 1);
  }

  function handleEditSaved() {
    setEditingEntry(null);
    setLocalRefresh((k) => k + 1);
  }

  const dayType = getDayType(new Date(logDate + "T00:00:00"));
  const target = targets.find((t) => t.day_type === dayType);
  const dayStyle = DAY_TYPE_STYLE[dayType];

  const totalKcal = entries.filter((e) => e.type === "meal").reduce((s, e) => s + ((e.data as MealData).total_kcal ?? 0), 0);
  const totalProtein = entries.filter((e) => e.type === "meal").reduce((s, e) => s + ((e.data as MealData).total_protein_g ?? 0), 0);
  const bmr = target?.bmr_kcal ?? 1633;
  const activeCalories = entries
    .filter((e) => e.type === "workout" || e.type === "cardio")
    .reduce((s, e) => s + (((e.data as WorkoutData | CardioData).calories_burned) ?? 0), 0);
  const totalBurned = bmr + activeCalories;
  const burnedTarget = bmr + (dayType === "gym" ? 500 : 300);

  const sortedEntries = [...entries].sort((a, b) => {
    const ta = a.entry_time ?? a.created_at ?? "";
    const tb = b.entry_time ?? b.created_at ?? "";
    return tb.localeCompare(ta);
  });

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  const dateLabel = new Date(logDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      {/* Hero summary card */}
      <Card>
        <CardContent className="px-5 py-5">
          {/* Date + day-type pill */}
          <div className="flex items-center justify-between mb-5">
            <p className="font-semibold text-base tracking-tight">{dateLabel}</p>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${dayStyle.bg} ${dayStyle.text}`}>
              {dayStyle.label}
            </span>
          </div>

          {/* Habit streaks */}
          <StreakStrip />

          {/* Three rings */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <RingCell
              label="Calories"
              value={Math.round(totalKcal)}
              max={target?.kcal_target ?? 2100}
              unit="kcal"
              color="var(--chart-2)"
            />
            <RingCell
              label="Protein"
              value={Math.round(totalProtein)}
              max={target?.protein_target_g ?? 140}
              unit="g"
              color="var(--chart-1)"
            />
            <RingCell
              label="Burned"
              value={Math.round(totalBurned)}
              max={burnedTarget}
              unit="kcal"
              color="var(--chart-3)"
            />
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <InsightsCard />

      {/* Entry timeline */}
      {sortedEntries.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2 text-center">
          <span className="text-5xl">📋</span>
          <p className="text-sm font-medium text-muted-foreground">Nothing logged yet</p>
          <p className="text-xs text-muted-foreground/70">Tap a button below to start tracking</p>
        </div>
      ) : (
        <div className="space-y-0 -mb-3">
          {sortedEntries.map((entry) => (
            <TimelineRow
              key={entry.id}
              entry={entry}
              onEdit={setEditingEntry}
              onDelete={handleDelete}
            />
          ))}
        </div>
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

function RingCell({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Ring value={value} max={max} size={72} stroke={7} color={color} />
      <p className="text-xs font-medium text-center">{label}</p>
      <p className="text-[11px] tabular-nums text-muted-foreground text-center">
        <span className="font-semibold text-foreground">{value}</span>
        {max > 0 && <span> / {max}</span>} {unit}
      </p>
    </div>
  );
}
