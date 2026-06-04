"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEntry, updateEntry, fetchCategories, ensureCategory } from "@/lib/api";
import type { Entry, IncomeData } from "@/lib/types";

type Props = {
  onSaved: () => void;
  editing?: Entry;
  onCancelEdit?: () => void;
  entryDate?: string;
};

const DEFAULT_CATEGORIES = ["Salary", "Freelance", "Refund", "Interest", "Transfer", "Other"];

export default function IncomeForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const existing = editing?.data as IncomeData | undefined;

  const [amount, setAmount] = useState(existing ? String(existing.amount_inr) : "");
  const [source, setSource] = useState(existing?.source ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_CATEGORIES);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories("income").then((cats) => {
      const names = cats.map((c) => c.name);
      const merged = [...new Set([...DEFAULT_CATEGORIES, ...names])];
      setSuggestions(merged);
    });
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

  const filtered = suggestions.filter((s) => s.toLowerCase().includes(category.toLowerCase()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) { setError("Enter a valid amount"); return; }
    if (!source.trim()) { setError("Source is required"); return; }
    if (!category.trim()) { setError("Category is required"); return; }

    setSaving(true);
    setError("");
    try {
      await ensureCategory(category.trim(), "income");
      const data: IncomeData = {
        amount_inr: amountNum,
        source: source.trim(),
        category: category.trim(),
      };
      if (editing) {
        await updateEntry(editing.id, "income", data as Record<string, unknown>);
      } else {
        await saveEntry("income", data as Record<string, unknown>, entryDate);
      }
      setAmount(""); setSource(""); setCategory("");
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
        <Label htmlFor="income-amount">Amount (₹)</Label>
        <Input
          id="income-amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="50000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="income-source">Source</Label>
        <Input
          id="income-source"
          placeholder="HDFC Salary, Client X freelance…"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </div>

      <div className="space-y-1.5" ref={catRef}>
        <Label htmlFor="income-category">Category</Label>
        <div className="relative">
          <Input
            id="income-category"
            placeholder="Salary, Freelance, Refund…"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
          />
          {showSuggestions && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md max-h-48 overflow-y-auto">
              {filtered.map((s) => (
                <li
                  key={s}
                  className="px-3 py-2 cursor-pointer hover:bg-accent text-sm min-h-[44px] flex items-center"
                  onMouseDown={() => { setCategory(s); setShowSuggestions(false); }}
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
          {saving ? "Saving…" : editing ? "Update" : "Log income"}
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
