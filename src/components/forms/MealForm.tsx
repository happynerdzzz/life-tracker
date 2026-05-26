"use client";

import { useState } from "react";
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
import type { Entry, MealData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
};

type Item = { food: string; qty: string; kcal: string; protein_g: string };

const emptyItem = (): Item => ({ food: "", qty: "", kcal: "", protein_g: "" });

export default function MealForm({ onSaved, editing, onCancelEdit }: Props) {
  const existing = editing?.data as MealData | undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [slot, setSlot] = useState<string>(existing?.slot ?? "");
  const [location, setLocation] = useState<string>(existing?.location ?? "");
  const [items, setItems] = useState<Item[]>(
    existing?.items?.map((i) => ({
      food: i.food,
      qty: i.qty,
      kcal: String(i.kcal),
      protein_g: String(i.protein_g),
    })) ?? [emptyItem()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalKcal = items.reduce((s, i) => s + (parseFloat(i.kcal) || 0), 0);
  const totalProtein = items.reduce((s, i) => s + (parseFloat(i.protein_g) || 0), 0);

  function updateItem(idx: number, field: keyof Item, val: string) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Meal name required"); return; }
    if (!slot) { setError("Slot required"); return; }
    if (!location) { setError("Location required"); return; }
    setSaving(true);
    setError("");
    const parsedItems = items
      .filter((i) => i.food.trim())
      .map((i) => ({
        food: i.food.trim(),
        qty: i.qty.trim(),
        kcal: parseFloat(i.kcal) || 0,
        protein_g: parseFloat(i.protein_g) || 0,
      }));
    const data = {
      name: name.trim(),
      slot,
      location,
      items: parsedItems,
      total_kcal: Math.round(totalKcal),
      total_protein_g: Math.round(totalProtein),
    };
    try {
      if (editing) {
        await updateEntry(editing.id, "meal", data);
      } else {
        await saveEntry("meal", data);
      }
      setName("");
      setSlot("");
      setLocation("");
      setItems([emptyItem()]);
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
        <Label htmlFor="meal-name">Meal name</Label>
        <Input
          id="meal-name"
          placeholder="Dal rice, chicken sandwich…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Slot</Label>
          <Select value={slot} onValueChange={(v) => setSlot(v ?? "")}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Select slot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="breakfast">Breakfast</SelectItem>
              <SelectItem value="lunch">Lunch</SelectItem>
              <SelectItem value="dinner">Dinner</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
              <SelectItem value="pre_workout">Pre-workout</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Select value={location} onValueChange={(v) => setLocation(v ?? "")}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Where?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Items</Label>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_64px_64px_32px] gap-1.5 items-start">
              <Input
                placeholder="Food"
                value={item.food}
                onChange={(e) => updateItem(idx, "food", e.target.value)}
                className="min-h-[44px]"
              />
              <Input
                placeholder="Qty"
                value={item.qty}
                onChange={(e) => updateItem(idx, "qty", e.target.value)}
                className="min-h-[44px]"
              />
              <Input
                type="number"
                placeholder="kcal"
                value={item.kcal}
                onChange={(e) => updateItem(idx, "kcal", e.target.value)}
                className="min-h-[44px]"
              />
              <Input
                type="number"
                placeholder="pro"
                value={item.protein_g}
                onChange={(e) => updateItem(idx, "protein_g", e.target.value)}
                className="min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="min-h-[44px] text-muted-foreground hover:text-destructive text-lg leading-none"
                aria-label="Remove item"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full min-h-[44px]">
          + Add item
        </Button>
      </div>

      {(totalKcal > 0 || totalProtein > 0) && (
        <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Total: <strong>{Math.round(totalKcal)} kcal</strong> · <strong>{Math.round(totalProtein)}g protein</strong>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? "Saving…" : editing ? "Update" : "Log meal"}
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
