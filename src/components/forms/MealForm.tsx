"use client";

import { useState, useEffect, useRef } from "react";
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
import { saveEntry, updateEntry, fetchFoods } from "@/lib/api";
import type { Entry, MealData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
  entryDate?: string;
};

type FoodRow = {
  id: string;
  name: string;
  kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  typical_serving: string | null;
};

type Item = {
  food: string;
  qty: string;
  kcal: string;
  protein_g: string;
  // DB-backed scaling (null = manual entry, no scaling)
  baseKcal: number | null;
  baseProtein: number | null;
  typicalServing: string | null;
  servings: string;
};

function emptyItem(): Item {
  return { food: "", qty: "", kcal: "", protein_g: "", baseKcal: null, baseProtein: null, typicalServing: null, servings: "1" };
}

function fromExisting(i: { food: string; qty: string; kcal: number; protein_g: number }): Item {
  return { food: i.food, qty: i.qty, kcal: String(i.kcal), protein_g: String(i.protein_g), baseKcal: null, baseProtein: null, typicalServing: null, servings: "1" };
}

// ─── Food autocomplete input ──────────────────────────────────────────────────

function FoodInput({
  value,
  onChange,
  onSelect,
  foods,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (f: FoodRow) => void;
  foods: FoodRow[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = value.trim().length > 0
    ? foods.filter((f) => f.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Food"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        className="min-h-[44px]"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-64 rounded-md border bg-background shadow-md max-h-52 overflow-y-auto">
          {filtered.map((f) => (
            <li
              key={f.id}
              className="px-3 py-2 cursor-pointer hover:bg-accent text-sm min-h-[40px] flex flex-col justify-center"
              onMouseDown={() => { onSelect(f); setOpen(false); }}
            >
              <span>{f.name}</span>
              {(f.kcal_per_serving != null || f.protein_g_per_serving != null) && (
                <span className="text-[11px] text-muted-foreground">
                  {f.typical_serving ? `${f.typical_serving} · ` : ""}
                  {f.kcal_per_serving != null ? `${f.kcal_per_serving} kcal` : ""}
                  {f.protein_g_per_serving != null ? ` · ${f.protein_g_per_serving}g protein` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function MealForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const existing = editing?.data as MealData | undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [slot, setSlot] = useState<string>(existing?.slot ?? "");
  const [location, setLocation] = useState<string>(existing?.location ?? "");
  const [items, setItems] = useState<Item[]>(
    existing?.items?.map(fromExisting) ?? [emptyItem()]
  );
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFoods().then(setFoods);
  }, []);

  const totalKcal = items.reduce((s, i) => s + (parseFloat(i.kcal) || 0), 0);
  const totalProtein = items.reduce((s, i) => s + (parseFloat(i.protein_g) || 0), 0);

  function updateItem(idx: number, field: keyof Item, val: string) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  }

  function updateServings(idx: number, val: string) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const n = parseFloat(val) || 1;
      return {
        ...item,
        servings: val,
        kcal: item.baseKcal != null ? String(Math.round(item.baseKcal * n)) : item.kcal,
        protein_g: item.baseProtein != null ? String(Math.round(item.baseProtein * n)) : item.protein_g,
        qty: item.typicalServing ? `${val} × ${item.typicalServing}` : val,
      };
    }));
  }

  function selectFood(idx: number, f: FoodRow) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const servings = parseFloat(item.servings) || 1;
      return {
        food: f.name,
        qty: f.typical_serving ?? item.qty,
        kcal: f.kcal_per_serving != null ? String(Math.round(f.kcal_per_serving * servings)) : item.kcal,
        protein_g: f.protein_g_per_serving != null ? String(Math.round(f.protein_g_per_serving * servings)) : item.protein_g,
        baseKcal: f.kcal_per_serving,
        baseProtein: f.protein_g_per_serving,
        typicalServing: f.typical_serving,
        servings: String(servings),
      };
    }));
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
        await saveEntry("meal", data, entryDate);
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
        <div className="grid grid-cols-[1fr_90px_64px_64px_32px] gap-x-1.5 text-xs text-muted-foreground px-1">
          <span>Food</span><span>Qty / Servings</span><span>kcal</span><span>protein</span><span />
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_90px_64px_64px_32px] gap-1.5 items-start">
              <FoodInput
                value={item.food}
                onChange={(v) => updateItem(idx, "food", v)}
                onSelect={(f) => selectFood(idx, f)}
                foods={foods}
              />
              {/* Servings input when food is DB-backed, else plain qty text */}
              {item.baseKcal != null ? (
                <div className="flex flex-col gap-0.5">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="1"
                    value={item.servings}
                    onChange={(e) => updateServings(idx, e.target.value)}
                    className="min-h-[44px]"
                  />
                  {item.typicalServing && (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      × {item.typicalServing}
                    </span>
                  )}
                </div>
              ) : (
                <Input
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, "qty", e.target.value)}
                  className="min-h-[44px]"
                />
              )}
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
