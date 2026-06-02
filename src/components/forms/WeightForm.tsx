"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEntry, updateEntry } from "@/lib/api";
import type { Entry } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
  entryDate?: string;
};

export default function WeightForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const [kg, setKg] = useState(
    editing ? String((editing.data as { kg: number }).kg) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(kg);
    if (isNaN(val) || val <= 0) {
      setError("Enter a valid weight");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateEntry(editing.id, "weight", { kg: val });
      } else {
        await saveEntry("weight", { kg: val }, entryDate);
      }
      setKg("");
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
        <Label htmlFor="weight-kg">Weight (kg)</Label>
        <Input
          id="weight-kg"
          type="number"
          step="0.1"
          min="0"
          placeholder="79.4"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          className="text-lg"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? "Saving…" : editing ? "Update" : "Save weight"}
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
