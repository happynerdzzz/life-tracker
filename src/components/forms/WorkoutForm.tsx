"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEntry, fetchExercises } from "@/lib/api";
import type { Entry, WorkoutData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
  entryDate?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const KCAL_PER_KG_REP = 0.04;
const KCAL_PER_BW_REP = 0.30;

const ALL_MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps",
  "Legs", "Glutes", "Core", "Calves", "Full body",
];

const WORKOUT_TEMPLATES: Record<string, { exercise: string; muscle_groups: string[] }[]> = {
  "Full Body": [
    { exercise: "Squat",           muscle_groups: ["Legs", "Glutes"] },
    { exercise: "Bench Press",     muscle_groups: ["Chest", "Triceps", "Shoulders"] },
    { exercise: "Deadlift",        muscle_groups: ["Back", "Legs", "Glutes"] },
    { exercise: "Overhead Press",  muscle_groups: ["Shoulders", "Triceps"] },
    { exercise: "Bent-over Row",   muscle_groups: ["Back", "Biceps"] },
  ],
  "Push": [
    { exercise: "Bench Press",            muscle_groups: ["Chest", "Triceps", "Shoulders"] },
    { exercise: "Overhead Press",         muscle_groups: ["Shoulders", "Triceps"] },
    { exercise: "Incline Dumbbell Press", muscle_groups: ["Chest", "Shoulders"] },
    { exercise: "Tricep Extension",       muscle_groups: ["Triceps"] },
    { exercise: "Lateral Raise",          muscle_groups: ["Shoulders"] },
  ],
  "Pull": [
    { exercise: "Deadlift",      muscle_groups: ["Back", "Legs", "Glutes"] },
    { exercise: "Pull-up",       muscle_groups: ["Back", "Biceps"] },
    { exercise: "Lat Pulldown",  muscle_groups: ["Back", "Biceps"] },
    { exercise: "Bent-over Row", muscle_groups: ["Back", "Biceps"] },
    { exercise: "Bicep Curl",    muscle_groups: ["Biceps"] },
  ],
  "Legs": [
    { exercise: "Squat",             muscle_groups: ["Legs", "Glutes"] },
    { exercise: "Romanian Deadlift", muscle_groups: ["Legs", "Glutes"] },
    { exercise: "Leg Press",         muscle_groups: ["Legs", "Glutes"] },
    { exercise: "Leg Curl",          muscle_groups: ["Legs"] },
    { exercise: "Calf Raise",        muscle_groups: ["Calves"] },
  ],
  "Upper": [
    { exercise: "Bench Press",    muscle_groups: ["Chest", "Triceps"] },
    { exercise: "Overhead Press", muscle_groups: ["Shoulders", "Triceps"] },
    { exercise: "Pull-up",        muscle_groups: ["Back", "Biceps"] },
    { exercise: "Bent-over Row",  muscle_groups: ["Back", "Biceps"] },
    { exercise: "Lateral Raise",  muscle_groups: ["Shoulders"] },
  ],
  "Lower": [
    { exercise: "Squat",             muscle_groups: ["Legs", "Glutes"] },
    { exercise: "Deadlift",          muscle_groups: ["Back", "Legs"] },
    { exercise: "Leg Press",         muscle_groups: ["Legs", "Glutes"] },
    { exercise: "Romanian Deadlift", muscle_groups: ["Legs", "Glutes"] },
    { exercise: "Calf Raise",        muscle_groups: ["Calves"] },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SetRow = { reps: string; weight_kg: string; notes: string };
type DbExercise = { id: string; name: string; muscle_groups: string[] | null };

type SessionExercise = {
  id: string; // client-only key
  exercise: string;
  muscle_groups: string[];
  sets: SetRow[];
  caloriesOverride: string;
};

function emptySet(): SetRow { return { reps: "", weight_kg: "", notes: "" }; }

function newExercise(exercise = "", muscle_groups: string[] = []): SessionExercise {
  return { id: Math.random().toString(36).slice(2), exercise, muscle_groups, sets: [emptySet()], caloriesOverride: "" };
}

function estimateKcal(sets: SetRow[]): number {
  let total = 0;
  for (const s of sets) {
    const reps = parseInt(s.reps) || 0;
    const wt = parseFloat(s.weight_kg) || 0;
    total += wt > 0 ? wt * reps * KCAL_PER_KG_REP : reps * KCAL_PER_BW_REP;
  }
  return Math.round(total);
}

// ─── Exercise name autocomplete ───────────────────────────────────────────────

function ExerciseInput({
  value,
  muscleGroups,
  dbExercises,
  onChange,
}: {
  value: string;
  muscleGroups: string[];
  dbExercises: DbExercise[];
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = dbExercises
    .filter((ex) => {
      const nameMatch = !value.trim() || ex.name.toLowerCase().includes(value.toLowerCase());
      const groupMatch =
        muscleGroups.length === 0 ||
        muscleGroups.some((g) => (ex.muscle_groups ?? []).includes(g));
      return nameMatch && groupMatch;
    })
    .slice(0, 10);

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Exercise name"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        className="min-h-[44px]"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-md max-h-52 overflow-y-auto">
          {filtered.map((ex) => (
            <li
              key={ex.id}
              className="px-3 py-2 cursor-pointer hover:bg-accent text-sm min-h-[40px] flex flex-col justify-center"
              onMouseDown={() => { onChange(ex.name); setOpen(false); }}
            >
              <span>{ex.name}</span>
              {ex.muscle_groups && ex.muscle_groups.length > 0 && (
                <span className="text-[11px] text-muted-foreground">{ex.muscle_groups.join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Single exercise card ─────────────────────────────────────────────────────

function ExerciseCard({
  ex,
  dbExercises,
  onChange,
  onRemove,
  canRemove,
}: {
  ex: SessionExercise;
  dbExercises: DbExercise[];
  onChange: (updated: SessionExercise) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const estimated = estimateKcal(ex.sets);
  const displayKcal = ex.caloriesOverride ? parseFloat(ex.caloriesOverride) || 0 : estimated;

  function updateSet(idx: number, field: keyof SetRow, val: string) {
    const sets = ex.sets.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    onChange({ ...ex, sets });
  }

  function addSet() { onChange({ ...ex, sets: [...ex.sets, emptySet()] }); }
  function removeSet(idx: number) { onChange({ ...ex, sets: ex.sets.filter((_, i) => i !== idx) }); }

  function toggleMuscle(m: string) {
    const muscle_groups = ex.muscle_groups.includes(m)
      ? ex.muscle_groups.filter((x) => x !== m)
      : [...ex.muscle_groups, m];
    onChange({ ...ex, muscle_groups });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <ExerciseInput
            value={ex.exercise}
            muscleGroups={ex.muscle_groups}
            dbExercises={dbExercises}
            onChange={(name) => onChange({ ...ex, exercise: name })}
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors text-lg leading-none p-1"
            aria-label="Remove exercise"
          >
            ×
          </button>
        )}
      </div>

      {/* Muscle group chips */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_MUSCLE_GROUPS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => toggleMuscle(m)}
            className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
              ex.muscle_groups.includes(m)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input bg-background hover:bg-accent text-muted-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Sets table */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-x-1.5 text-[11px] text-muted-foreground px-1">
          <span>#</span><span>Reps</span><span>kg</span><span>Notes</span><span />
        </div>
        {ex.sets.map((s, idx) => (
          <div key={idx} className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-1.5 items-start">
            <div className="min-h-[40px] flex items-center justify-center text-xs text-muted-foreground">{idx + 1}</div>
            <Input type="number" placeholder="8" value={s.reps} onChange={(e) => updateSet(idx, "reps", e.target.value)} className="min-h-[40px] text-sm" />
            <Input type="number" step="any" placeholder="60" value={s.weight_kg} onChange={(e) => updateSet(idx, "weight_kg", e.target.value)} className="min-h-[40px] text-sm" />
            <Input placeholder="notes" value={s.notes} onChange={(e) => updateSet(idx, "notes", e.target.value)} className="min-h-[40px] text-sm" />
            <button type="button" onClick={() => removeSet(idx)} className="min-h-[40px] text-muted-foreground hover:text-destructive text-base leading-none">×</button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addSet} className="w-full min-h-[36px] text-xs">+ Add set</Button>
      </div>

      {/* Calorie row */}
      <div className="flex items-center gap-2">
        <Label htmlFor={`kcal-${ex.id}`} className="text-xs text-muted-foreground shrink-0">
          Calories burned
          {!ex.caloriesOverride && estimated > 0 && (
            <span className="ml-1 text-[10px]">(~{estimated} est.)</span>
          )}
        </Label>
        <Input
          id={`kcal-${ex.id}`}
          type="number"
          step="any"
          placeholder={estimated > 0 ? String(estimated) : "kcal"}
          value={ex.caloriesOverride}
          onChange={(e) => onChange({ ...ex, caloriesOverride: e.target.value })}
          className="h-8 text-sm max-w-[90px]"
        />
        {displayKcal > 0 && (
          <span className="text-xs text-muted-foreground">{displayKcal} kcal</span>
        )}
      </div>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function WorkoutForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const [exercises, setExercises] = useState<SessionExercise[]>(() => {
    if (editing) {
      const d = editing.data as WorkoutData;
      return [{
        id: "edit",
        exercise: d.exercise,
        muscle_groups: d.muscle_groups ?? [],
        sets: d.sets?.map((s) => ({
          reps: String(s.reps),
          weight_kg: s.weight_kg != null ? String(s.weight_kg) : "",
          notes: s.notes ?? "",
        })) ?? [emptySet()],
        caloriesOverride: d.calories_burned != null ? String(d.calories_burned) : "",
      }];
    }
    return [newExercise()];
  });

  const [dbExercises, setDbExercises] = useState<DbExercise[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchExercises().then(setDbExercises);
  }, []);

  const applyTemplate = useCallback((name: string) => {
    const tmpl = WORKOUT_TEMPLATES[name];
    if (!tmpl) return;
    setExercises(tmpl.map((t) => newExercise(t.exercise, t.muscle_groups)));
    setActiveTemplate(name);
  }, []);

  function updateExercise(idx: number, updated: SessionExercise) {
    setExercises((prev) => prev.map((e, i) => i === idx ? updated : e));
  }

  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  function addExercise() {
    setExercises((prev) => [...prev, newExercise()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = exercises.filter((ex) => ex.exercise.trim());
    if (valid.length === 0) { setError("Add at least one exercise"); return; }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        // Edit mode: update single entry (keep existing ID)
        const ex = valid[0];
        const { updateEntry } = await import("@/lib/api");
        const estimated = estimateKcal(ex.sets);
        const calories = ex.caloriesOverride ? parseFloat(ex.caloriesOverride) || 0 : estimated;
        const data: WorkoutData = {
          exercise: ex.exercise.trim(),
          sets: ex.sets.filter((s) => s.reps.trim()).map((s) => ({
            reps: parseInt(s.reps) || 0,
            weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
            ...(s.notes.trim() ? { notes: s.notes.trim() } : {}),
          })),
          muscle_groups: ex.muscle_groups,
          ...(calories > 0 ? { calories_burned: calories } : {}),
        };
        await updateEntry(editing.id, "workout", data as Record<string, unknown>);
      } else {
        // Session save: one entry per exercise
        await Promise.all(valid.map((ex) => {
          const estimated = estimateKcal(ex.sets);
          const calories = ex.caloriesOverride ? parseFloat(ex.caloriesOverride) || 0 : estimated;
          const data: WorkoutData = {
            exercise: ex.exercise.trim(),
            sets: ex.sets.filter((s) => s.reps.trim()).map((s) => ({
              reps: parseInt(s.reps) || 0,
              weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
              ...(s.notes.trim() ? { notes: s.notes.trim() } : {}),
            })),
            muscle_groups: ex.muscle_groups,
            ...(calories > 0 ? { calories_burned: calories } : {}),
          };
          return saveEntry("workout", data as Record<string, unknown>, entryDate);
        }));
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Template picker — hidden in edit mode */}
      {!editing && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Template</Label>
          <div className="flex flex-wrap gap-2">
            {Object.keys(WORKOUT_TEMPLATES).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => applyTemplate(name)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  activeTemplate === name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input bg-background hover:bg-accent text-muted-foreground"
                }`}
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setExercises([newExercise()]); setActiveTemplate(null); }}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                activeTemplate === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent text-muted-foreground"
              }`}
            >
              Custom
            </button>
          </div>
        </div>
      )}

      {/* Exercise cards */}
      <div className="space-y-3">
        {exercises.map((ex, idx) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            dbExercises={dbExercises}
            onChange={(updated) => updateExercise(idx, updated)}
            onRemove={() => removeExercise(idx)}
            canRemove={exercises.length > 1}
          />
        ))}
      </div>

      {/* Add exercise + total kcal */}
      {!editing && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={addExercise} className="min-h-[36px] text-xs">
            + Add exercise
          </Button>
          {(() => {
            const total = exercises.reduce((s, ex) => {
              const est = estimateKcal(ex.sets);
              return s + (ex.caloriesOverride ? parseFloat(ex.caloriesOverride) || 0 : est);
            }, 0);
            return total > 0 ? (
              <span className="text-xs text-muted-foreground">Session total: <strong>{total} kcal</strong></span>
            ) : null;
          })()}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? "Saving…" : editing ? "Update" : "Save session"}
        </Button>
        {(editing || onCancelEdit) && (
          <Button type="button" variant="outline" onClick={onCancelEdit} className="min-h-[44px]">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
