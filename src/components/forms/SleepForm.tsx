"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEntry, updateEntry } from "@/lib/api";
import type { Entry, SleepData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
};

const QUALITY_LABELS = ["", "Terrible", "Poor", "Okay", "Good", "Great"];

export default function SleepForm({ onSaved, editing, onCancelEdit }: Props) {
  const existing = editing?.data as SleepData | undefined;
  const [hours, setHours] = useState(existing ? String(existing.hours) : "");
  const [quality, setQuality] = useState<number>(existing?.quality ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 24) {
      setError("Enter valid hours (0–24)");
      return;
    }
    setSaving(true);
    setError("");
    const data: Record<string, unknown> = { hours: h };
    if (quality > 0) data.quality = quality;
    try {
      if (editing) {
        await updateEntry(editing.id, "sleep", data);
      } else {
        await saveEntry("sleep", data);
      }
      setHours("");
      setQuality(0);
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
        <Label htmlFor="sleep-hours">Hours slept</Label>
        <Input
          id="sleep-hours"
          type="number"
          step="0.5"
          min="0"
          max="24"
          placeholder="7.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Quality (optional)</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuality(quality === q ? 0 : q)}
              className={`flex-1 min-h-[44px] rounded-md border text-sm font-medium transition-colors
                ${quality === q
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent"
                }`}
            >
              {q}
              <span className="block text-[10px] leading-tight">{QUALITY_LABELS[q]}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? "Saving…" : editing ? "Update" : "Log sleep"}
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
