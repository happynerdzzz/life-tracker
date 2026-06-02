"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEntry, updateEntry, fetchCategories, ensureCategory } from "@/lib/api";
import type { Entry, ExpenseData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
  entryDate?: string;
};

export default function ExpenseForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const existing = editing?.data as ExpenseData | undefined;
  const [amount, setAmount] = useState(existing ? String(existing.amount_inr) : "");
  const [item, setItem] = useState(existing?.item ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories("expense").then((cats) =>
      setSuggestions(cats.map((c) => c.name))
    );
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(category.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!item.trim()) {
      setError("Item is required");
      return;
    }
    if (!category.trim()) {
      setError("Category is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await ensureCategory(category.trim(), "expense");
      const data = { amount_inr: amt, item: item.trim(), category: category.trim() };
      if (editing) {
        await updateEntry(editing.id, "expense", data);
      } else {
        await saveEntry("expense", data, entryDate);
      }
      setAmount("");
      setItem("");
      setCategory("");
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
        <Label htmlFor="expense-amount">Amount (₹)</Label>
        <Input
          id="expense-amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="250"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expense-item">Item</Label>
        <Input
          id="expense-item"
          placeholder="Chicken breast, gym supplement…"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />
      </div>
      <div className="space-y-1.5" ref={catRef}>
        <Label htmlFor="expense-category">Category</Label>
        <div className="relative">
          <Input
            id="expense-category"
            placeholder="Groceries, eating out, supplements…"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
          />
          {showSuggestions && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md max-h-48 overflow-y-auto">
              {filtered.map((s) => (
                <li
                  key={s}
                  className="px-3 py-2 cursor-pointer hover:bg-accent text-sm min-h-[44px] flex items-center"
                  onMouseDown={() => {
                    setCategory(s);
                    setShowSuggestions(false);
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
          {saving ? "Saving…" : editing ? "Update" : "Log expense"}
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
