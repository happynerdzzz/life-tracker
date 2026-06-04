"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveEntry, updateEntry } from "@/lib/api";
import type { Entry, CardioData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
  entryDate?: string;
};

type Intensity = "low" | "moderate" | "high";

// MET values per activity per intensity (kcal = MET × weight_kg × hours)
const MET: Record<string, Record<Intensity, number>> = {
  Swimming:        { low: 5.5, moderate: 7.0, high: 10.0 },
  Running:         { low: 6.0, moderate: 8.3, high: 11.0 },
  Cycling:         { low: 4.0, moderate: 8.0, high: 12.0 },
  Walking:         { low: 2.5, moderate: 3.5, high:  4.5 },
  "Table Tennis":  { low: 3.5, moderate: 4.0, high:  5.0 },
  Cricket:         { low: 3.5, moderate: 4.5, high:  5.5 },
  Badminton:       { low: 4.5, moderate: 5.5, high:  7.0 },
  Dance:           { low: 3.0, moderate: 4.5, high:  6.0 },
  Rowing:          { low: 4.5, moderate: 7.0, high: 10.0 },
  "Jump Rope":     { low: 8.0, moderate: 10.0, high: 12.0 },
  Yoga:            { low: 2.5, moderate: 3.0, high:  4.0 },
  Other:           { low: 4.0, moderate: 5.5, high:  8.0 },
};

const ACTIVITIES = Object.keys(MET);
const DEFAULT_WEIGHT_KG = 77;

const ACTIVITY_LABELS: Record<string, string> = {
  Swimming: "🏊 Swimming",
  Running: "🏃 Running",
  Cycling: "🚴 Cycling",
  Walking: "🚶 Walking",
  "Table Tennis": "🏓 Table Tennis",
  Cricket: "🏏 Cricket",
  Badminton: "🏸 Badminton",
  Dance: "💃 Dance",
  Rowing: "🚣 Rowing",
  "Jump Rope": "Jump Rope",
  Yoga: "🧘 Yoga",
  Other: "Other",
};

export default function CardioForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const existing = editing?.data as CardioData | undefined;

  const [activity, setActivity] = useState(existing?.activity ?? "");
  const [duration, setDuration] = useState(existing ? String(existing.duration_min) : "");
  const [intensity, setIntensity] = useState<Intensity>(existing?.intensity ?? "moderate");
  const [distanceKm, setDistanceKm] = useState(existing?.distance_km != null ? String(existing.distance_km) : "");
  const [caloriesOverride, setCaloriesOverride] = useState(
    existing?.calories_burned != null ? String(existing.calories_burned) : ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const durationNum = parseFloat(duration) || 0;

  const estimatedKcal = useMemo(() => {
    if (!activity || durationNum <= 0) return null;
    const met = MET[activity]?.[intensity] ?? MET["Other"][intensity];
    return Math.round(met * DEFAULT_WEIGHT_KG * (durationNum / 60));
  }, [activity, durationNum, intensity]);

  const finalCalories = caloriesOverride
    ? parseFloat(caloriesOverride) || 0
    : (estimatedKcal ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activity.trim()) { setError("Select an activity"); return; }
    if (!durationNum || durationNum <= 0) { setError("Enter duration"); return; }

    setSaving(true);
    setError("");
    const data: CardioData = {
      activity: activity.trim(),
      duration_min: Math.round(durationNum),
      intensity,
      ...(distanceKm ? { distance_km: parseFloat(distanceKm) } : {}),
      ...(finalCalories > 0 ? { calories_burned: finalCalories } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    try {
      if (editing) {
        await updateEntry(editing.id, "cardio", data as Record<string, unknown>);
      } else {
        await saveEntry("cardio", data as Record<string, unknown>, entryDate);
      }
      setActivity(""); setDuration(""); setIntensity("moderate");
      setDistanceKm(""); setCaloriesOverride(""); setNotes("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Activity</Label>
        <Select value={activity} onValueChange={(v) => setActivity(v ?? "")}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue placeholder="Choose activity" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITIES.map((a) => (
              <SelectItem key={a} value={a}>{ACTIVITY_LABELS[a] ?? a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cardio-duration">Duration (min)</Label>
          <Input
            id="cardio-duration"
            type="number"
            min="1"
            placeholder="30"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Intensity</Label>
          <Select value={intensity} onValueChange={(v) => setIntensity(v as Intensity)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cardio-distance">Distance (km) <span className="text-muted-foreground font-normal">optional</span></Label>
          <Input
            id="cardio-distance"
            type="number"
            step="0.1"
            placeholder="1.5"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardio-kcal">
            Calories burned
            {estimatedKcal != null && !caloriesOverride && (
              <span className="text-muted-foreground font-normal text-[11px] ml-1">~{estimatedKcal} est.</span>
            )}
          </Label>
          <Input
            id="cardio-kcal"
            type="number"
            placeholder={estimatedKcal != null ? String(estimatedKcal) : "kcal"}
            value={caloriesOverride}
            onChange={(e) => setCaloriesOverride(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cardio-notes">Notes <span className="text-muted-foreground font-normal">optional</span></Label>
        <Input
          id="cardio-notes"
          placeholder="Felt good, outdoor pool…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[44px]"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? "Saving…" : editing ? "Update" : "Log cardio"}
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
