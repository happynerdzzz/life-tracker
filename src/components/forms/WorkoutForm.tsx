"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEntry, updateEntry, fetchExercises } from "@/lib/api";
import type { Entry, WorkoutData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
  entryDate?: string;
};

type SetRow = { reps: string; weight_kg: string; notes: string };

const emptySet = (): SetRow => ({ reps: "", weight_kg: "", notes: "" });

const ALL_MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps",
  "Legs", "Glutes", "Core", "Calves", "Full body",
];

const WORKOUT_MET = 4.5;
const DEFAULT_WEIGHT_KG = 77;

export default function WorkoutForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const existing = editing?.data as WorkoutData | undefined;
  const [exercise, setExercise] = useState(existing?.exercise ?? "");
  const [sets, setSets] = useState<SetRow[]>(
    existing?.sets?.map((s) => ({
      reps: String(s.reps),
      weight_kg: s.weight_kg != null ? String(s.weight_kg) : "",
      notes: s.notes ?? "",
    })) ?? [emptySet()]
  );
  const [muscleGroups, setMuscleGroups] = useState<string[]>(existing?.muscle_groups ?? []);
  const [duration, setDuration] = useState(existing?.duration_min != null ? String(existing.duration_min) : "");
  const [caloriesOverride, setCaloriesOverride] = useState(
    existing?.calories_burned != null ? String(existing.calories_burned) : ""
  );
  const [exercises, setExercises] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const exRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchExercises().then((list) => setExercises(list.map((e) => e.name)));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exRef.current && !exRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredEx = exercises.filter((e) =>
    e.toLowerCase().includes(exercise.toLowerCase())
  );

  const durationNum = parseFloat(duration) || 0;
  const estimatedKcal = useMemo(() => {
    if (!durationNum) return null;
    return Math.round(WORKOUT_MET * DEFAULT_WEIGHT_KG * (durationNum / 60));
  }, [durationNum]);

  const finalCalories = caloriesOverride
    ? parseFloat(caloriesOverride) || 0
    : (estimatedKcal ?? 0);

  function updateSet(idx: number, field: keyof SetRow, val: string) {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));
  }

  function toggleMuscle(m: string) {
    setMuscleGroups((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exercise.trim()) { setError("Exercise name required"); return; }
    setSaving(true);
    setError("");
    const parsedSets = sets
      .filter((s) => s.reps.trim())
      .map((s) => ({
        reps: parseInt(s.reps) || 0,
        weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
        ...(s.notes.trim() ? { notes: s.notes.trim() } : {}),
      }));
    const data: WorkoutData = {
      exercise: exercise.trim(),
      sets: parsedSets,
      muscle_groups: muscleGroups,
      ...(durationNum > 0 ? { duration_min: Math.round(durationNum) } : {}),
      ...(finalCalories > 0 ? { calories_burned: finalCalories } : {}),
    };
    try {
      if (editing) {
        await updateEntry(editing.id, "workout", data as Record<string, unknown>);
      } else {
        await saveEntry("workout", data as Record<string, unknown>, entryDate);
      }
      setExercise("");
      setSets([emptySet()]);
      setMuscleGroups([]);
      setDuration("");
      setCaloriesOverride("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5" ref={exRef}>
        <Label htmlFor="workout-exercise">Exercise</Label>
        <div className="relative">
          <Input
            id="workout-exercise"
            placeholder="Bench press, squat, deadlift…"
            value={exercise}
            onChange={(e) => { setExercise(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
          />
          {showSuggestions && filteredEx.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md max-h-48 overflow-y-auto">
              {filteredEx.map((ex) => (
                <li
                  key={ex}
                  className="px-3 py-2 cursor-pointer hover:bg-accent text-sm min-h-[44px] flex items-center"
                  onMouseDown={() => { setExercise(ex); setShowSuggestions(false); }}
                >
                  {ex}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Sets</Label>
        <div className="grid grid-cols-[40px_1fr_1fr_1fr_32px] gap-x-1.5 gap-y-0 text-xs text-muted-foreground px-1 mb-1">
          <span>#</span><span>Reps</span><span>Weight (kg)</span><span>Notes</span><span />
        </div>
        <div className="space-y-1.5">
          {sets.map((s, idx) => (
            <div key={idx} className="grid grid-cols-[40px_1fr_1fr_1fr_32px] gap-1.5 items-start">
              <div className="min-h-[44px] flex items-center justify-center text-sm text-muted-foreground">
                {idx + 1}
              </div>
              <Input
                type="number"
                placeholder="8"
                value={s.reps}
                onChange={(e) => updateSet(idx, "reps", e.target.value)}
                className="min-h-[44px]"
              />
              <Input
                type="number"
                step="0.5"
                placeholder="60"
                value={s.weight_kg}
                onChange={(e) => updateSet(idx, "weight_kg", e.target.value)}
                className="min-h-[44px]"
              />
              <Input
                placeholder="notes"
                value={s.notes}
                onChange={(e) => updateSet(idx, "notes", e.target.value)}
                className="min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setSets((prev) => prev.filter((_, i) => i !== idx))}
                className="min-h-[44px] text-muted-foreground hover:text-destructive text-lg"
                aria-label="Remove set"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setSets((p) => [...p, emptySet()])} className="w-full min-h-[44px]">
          + Add set
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Muscle groups</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMuscle(m)}
              className={`px-3 py-1.5 rounded-full border text-sm min-h-[36px] transition-colors
                ${muscleGroups.includes(m)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent"
                }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Duration + calorie burn */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="workout-duration">
            Duration (min) <span className="text-muted-foreground font-normal">optional</span>
          </Label>
          <Input
            id="workout-duration"
            type="number"
            min="1"
            placeholder="15"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workout-kcal">
            Calories burned
            {estimatedKcal != null && !caloriesOverride && (
              <span className="text-muted-foreground font-normal text-[11px] ml-1">~{estimatedKcal} est.</span>
            )}
          </Label>
          <Input
            id="workout-kcal"
            type="number"
            placeholder={estimatedKcal != null ? String(estimatedKcal) : "kcal"}
            value={caloriesOverride}
            onChange={(e) => setCaloriesOverride(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? "Saving…" : editing ? "Update" : "Log workout"}
        </Button>
        {editing && (
          <Button type="button" variant="outline" onClick={onCancelEdit} className="min-h-[44px]">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
