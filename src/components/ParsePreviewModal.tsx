"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ParseResponse,
  ParsedEntry,
  ParsedMealEntry,
  ParsedMealItem,
  ParsedWorkoutEntry,
  ParsedSet,
} from "@/lib/parser/schema";

type Props = {
  result: ParseResponse;
  entryDate: string;
  rawText: string;
  onSaved: () => void;
  onCancel: () => void;
};

const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps",
  "Legs", "Glutes", "Core", "Calves", "Full body",
];

// ─── Per-type card editors ────────────────────────────────────────────────────

function WeightCard({
  entry,
  onChange,
}: {
  entry: Extract<ParsedEntry, { type: "weight" }>;
  onChange: (e: ParsedEntry) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-20 shrink-0">Weight</span>
      <Input
        type="number"
        step="0.1"
        value={entry.kg}
        onChange={(ev) => onChange({ ...entry, kg: parseFloat(ev.target.value) || 0 })}
        className="w-28"
      />
      <span className="text-sm text-muted-foreground">kg</span>
    </div>
  );
}

function MealCard({
  entry,
  newFoods,
  onChange,
}: {
  entry: ParsedMealEntry;
  newFoods: string[];
  onChange: (e: ParsedEntry) => void;
}) {
  function updateItem(idx: number, patch: Partial<ParsedMealItem>) {
    const newItems = entry.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    const total_kcal = Math.round(newItems.reduce((s, i) => s + i.kcal, 0));
    const total_protein_g = Math.round(newItems.reduce((s, i) => s + i.protein_g, 0));
    onChange({ ...entry, items: newItems, total_kcal, total_protein_g });
  }

  function removeItem(idx: number) {
    const newItems = entry.items.filter((_, i) => i !== idx);
    const total_kcal = Math.round(newItems.reduce((s, i) => s + i.kcal, 0));
    const total_protein_g = Math.round(newItems.reduce((s, i) => s + i.protein_g, 0));
    onChange({ ...entry, items: newItems, total_kcal, total_protein_g });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Name</span>
          <Input
            value={entry.name}
            onChange={(ev) => onChange({ ...entry, name: ev.target.value })}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Slot</span>
          <Select value={entry.slot} onValueChange={(v) => onChange({ ...entry, slot: v as ParsedMealEntry["slot"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="breakfast">Breakfast</SelectItem>
              <SelectItem value="lunch">Lunch</SelectItem>
              <SelectItem value="dinner">Dinner</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
              <SelectItem value="pre_workout">Pre-workout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Location</span>
        <Select value={entry.location} onValueChange={(v) => onChange({ ...entry, location: v as ParsedMealEntry["location"] })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="home">Home</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <div className="grid grid-cols-[1fr_70px_60px_60px_28px] gap-1 text-xs text-muted-foreground px-1">
          <span>Food</span><span>Qty</span><span>kcal</span><span>pro g</span><span />
        </div>
        {entry.items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_70px_60px_60px_28px] gap-1 items-center">
            <div className="relative">
              <Input
                value={item.food}
                onChange={(ev) => updateItem(idx, { food: ev.target.value })}
                className="pr-10"
              />
              {newFoods.includes(item.food) && (
                <Badge className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-500">
                  new
                </Badge>
              )}
            </div>
            <Input
              value={item.qty}
              onChange={(ev) => updateItem(idx, { qty: ev.target.value })}
            />
            <Input
              type="number"
              value={item.kcal}
              onChange={(ev) => updateItem(idx, { kcal: parseFloat(ev.target.value) || 0 })}
            />
            <Input
              type="number"
              value={item.protein_g}
              onChange={(ev) => updateItem(idx, { protein_g: parseFloat(ev.target.value) || 0 })}
            />
            <button
              onClick={() => removeItem(idx)}
              className="text-muted-foreground hover:text-destructive text-base leading-none h-full flex items-center justify-center"
            >×</button>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-1.5">
        Total: <strong>{entry.total_kcal} kcal</strong> · <strong>{entry.total_protein_g}g protein</strong>
        {item_note(entry) && <span className="ml-2 italic">{item_note(entry)}</span>}
      </div>
    </div>
  );
}

function item_note(entry: ParsedMealEntry): string {
  const notes = entry.items.flatMap((i) => (i.match_note ? [i.match_note] : []));
  return notes.length ? notes.join("; ") : "";
}

function WorkoutCard({
  entry,
  newExercises,
  onChange,
}: {
  entry: ParsedWorkoutEntry;
  newExercises: string[];
  onChange: (e: ParsedEntry) => void;
}) {
  function updateSet(idx: number, patch: Partial<ParsedSet>) {
    onChange({
      ...entry,
      sets: entry.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  }

  function toggleMuscle(m: string) {
    const groups = entry.muscle_groups.includes(m)
      ? entry.muscle_groups.filter((x) => x !== m)
      : [...entry.muscle_groups, m];
    onChange({ ...entry, muscle_groups: groups });
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Exercise</span>
        <div className="relative">
          <Input
            value={entry.exercise}
            onChange={(ev) => onChange({ ...entry, exercise: ev.target.value })}
          />
          {newExercises.includes(entry.exercise) && (
            <Badge className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-500">
              new
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="grid grid-cols-[32px_1fr_1fr_1fr] gap-1.5 text-xs text-muted-foreground px-1">
          <span>#</span><span>Reps</span><span>kg</span><span>Notes</span>
        </div>
        {entry.sets.map((s, idx) => (
          <div key={idx} className="grid grid-cols-[32px_1fr_1fr_1fr] gap-1.5 items-center">
            <span className="text-xs text-muted-foreground text-center">{idx + 1}</span>
            <Input
              type="number"
              value={s.reps}
              onChange={(ev) => updateSet(idx, { reps: parseInt(ev.target.value) || 0 })}
            />
            <Input
              type="number"
              step="0.5"
              placeholder="BW"
              value={s.weight_kg ?? ""}
              onChange={(ev) =>
                updateSet(idx, { weight_kg: ev.target.value ? parseFloat(ev.target.value) : null })
              }
            />
            <Input
              value={s.notes ?? ""}
              onChange={(ev) => updateSet(idx, { notes: ev.target.value || undefined })}
              placeholder="—"
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Muscles</span>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMuscle(m)}
              className={`px-2.5 py-1 rounded-full border text-xs transition-colors
                ${entry.muscle_groups.includes(m)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardioCard({
  entry,
  onChange,
}: {
  entry: Extract<ParsedEntry, { type: "cardio" }>;
  onChange: (e: ParsedEntry) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Activity</span>
        <Input value={entry.activity} onChange={(ev) => onChange({ ...entry, activity: ev.target.value })} />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Duration (min)</span>
        <Input type="number" value={entry.duration_min} onChange={(ev) => onChange({ ...entry, duration_min: parseInt(ev.target.value) || 0 })} />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Intensity</span>
        <Select
          value={entry.intensity ?? ""}
          onValueChange={(v) => onChange({ ...entry, intensity: (v || undefined) as typeof entry.intensity })}
        >
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Distance (km)</span>
        <Input
          type="number"
          step="0.1"
          placeholder="—"
          value={entry.distance_km ?? ""}
          onChange={(ev) => onChange({ ...entry, distance_km: ev.target.value ? parseFloat(ev.target.value) : undefined })}
        />
      </div>
    </div>
  );
}

function SleepCard({
  entry,
  onChange,
}: {
  entry: Extract<ParsedEntry, { type: "sleep" }>;
  onChange: (e: ParsedEntry) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Hours</span>
        <Input
          type="number"
          step="0.5"
          value={entry.hours}
          onChange={(ev) => onChange({ ...entry, hours: parseFloat(ev.target.value) || 0 })}
          className="w-24"
        />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Quality</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onChange({ ...entry, quality: (entry.quality === q ? undefined : q) as typeof entry.quality })}
              className={`w-9 h-9 rounded-md border text-sm font-medium transition-colors
                ${entry.quality === q
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent"}`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseCard({
  entry,
  newCategories,
  onChange,
}: {
  entry: Extract<ParsedEntry, { type: "expense" }>;
  newCategories: string[];
  onChange: (e: ParsedEntry) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Amount (₹)</span>
        <Input
          type="number"
          value={entry.amount_inr}
          onChange={(ev) => onChange({ ...entry, amount_inr: parseFloat(ev.target.value) || 0 })}
        />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Item</span>
        <Input value={entry.item} onChange={(ev) => onChange({ ...entry, item: ev.target.value })} />
      </div>
      <div className="col-span-2 space-y-1">
        <span className="text-xs text-muted-foreground">Category</span>
        <div className="relative">
          <Input
            value={entry.category}
            onChange={(ev) => onChange({ ...entry, category: ev.target.value })}
          />
          {newCategories.includes(entry.category) && (
            <Badge className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-500">
              new
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  entry,
  onChange,
}: {
  entry: Extract<ParsedEntry, { type: "note" }>;
  onChange: (e: ParsedEntry) => void;
}) {
  return (
    <textarea
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
      rows={3}
      value={entry.text}
      onChange={(ev) => onChange({ ...entry, text: ev.target.value })}
    />
  );
}

// ─── Type icon ────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, string> = {
  weight: "⚖️", meal: "🍽️", workout: "🏋️", cardio: "🏊", sleep: "😴", expense: "💸", note: "📝",
};

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ParsePreviewModal({ result, entryDate, rawText, onSaved, onCancel }: Props) {
  const [entries, setEntries] = useState<ParsedEntry[]>(result.entries);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function updateEntry(idx: number, newEntry: ParsedEntry) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? newEntry : e)));
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveAll() {
    if (entries.length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/parse/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          entry_date: entryDate,
          raw_text: rawText,
          new_items: result.new_items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Save failed. Try again.");
        return;
      }
      onSaved();
    } catch {
      setSaveError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b shrink-0">
          <p className="font-semibold">
            Parsed {result.entries.length} {result.entries.length === 1 ? "entry" : "entries"} — review and edit before saving
          </p>
          {result.parse_notes && (
            <p className="mt-1.5 text-sm bg-blue-50 text-blue-800 rounded px-3 py-2 border border-blue-200">
              ℹ️ {result.parse_notes}
            </p>
          )}
        </div>

        {/* Entries list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No entries — click Cancel to go back.
            </p>
          ) : (
            entries.map((entry, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{TYPE_ICONS[entry.type] ?? "📌"}</span>
                    <span className="font-medium text-sm capitalize">{entry.type}</span>
                    {entry.type === "meal" && (
                      <span className="text-xs text-muted-foreground">({entry.slot})</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeEntry(idx)}
                    className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
                  >
                    Remove
                  </button>
                </div>

                {entry.type === "weight" && (
                  <WeightCard entry={entry} onChange={(e) => updateEntry(idx, e)} />
                )}
                {entry.type === "meal" && (
                  <MealCard
                    entry={entry}
                    newFoods={result.new_items.foods}
                    onChange={(e) => updateEntry(idx, e)}
                  />
                )}
                {entry.type === "workout" && (
                  <WorkoutCard
                    entry={entry}
                    newExercises={result.new_items.exercises}
                    onChange={(e) => updateEntry(idx, e)}
                  />
                )}
                {entry.type === "cardio" && (
                  <CardioCard entry={entry} onChange={(e) => updateEntry(idx, e)} />
                )}
                {entry.type === "sleep" && (
                  <SleepCard entry={entry} onChange={(e) => updateEntry(idx, e)} />
                )}
                {entry.type === "expense" && (
                  <ExpenseCard
                    entry={entry}
                    newCategories={result.new_items.categories}
                    onChange={(e) => updateEntry(idx, e)}
                  />
                )}
                {entry.type === "note" && (
                  <NoteCard entry={entry} onChange={(e) => updateEntry(idx, e)} />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t shrink-0 space-y-2">
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          <div className="flex gap-2">
            <Button
              className="flex-1 min-h-[44px]"
              onClick={handleSaveAll}
              disabled={saving}
            >
              {saving ? "Saving…" : `Save ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
            </Button>
            <Button variant="outline" className="min-h-[44px]" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
