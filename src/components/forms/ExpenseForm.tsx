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

type SplitPerson = { name: string; share: string; settled: boolean };

export default function ExpenseForm({ onSaved, editing, onCancelEdit, entryDate }: Props) {
  const existing = editing?.data as ExpenseData | undefined;
  const existingSplit = existing?.split;

  const [amount, setAmount] = useState(existing ? String(existing.amount_inr) : "");
  const [item, setItem] = useState(existing?.item ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  // Split state
  const [splitEnabled, setSplitEnabled] = useState(!!existingSplit);
  const [totalBill, setTotalBill] = useState(existingSplit ? String(existingSplit.total_amount) : "");
  const [paidBy, setPaidBy] = useState<"me" | "other">(
    !existingSplit || existingSplit.paid_by === "me" ? "me" : "other"
  );
  const [paidByName, setPaidByName] = useState(
    existingSplit && existingSplit.paid_by !== "me" ? existingSplit.paid_by : ""
  );
  const [splitPeople, setSplitPeople] = useState<SplitPerson[]>(
    existingSplit?.participants.map((p) => ({
      name: p.name,
      share: String(p.share),
      settled: p.settled,
    })) ?? []
  );

  useEffect(() => {
    fetchCategories("expense").then((cats) => setSuggestions(cats.map((c) => c.name)));
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

  // Derive my share when split is enabled
  const totalBillNum = parseFloat(totalBill) || 0;
  const othersShareTotal = splitPeople.reduce((s, p) => s + (parseFloat(p.share) || 0), 0);
  const myShare = paidBy === "me"
    ? Math.max(0, totalBillNum - othersShareTotal)
    : parseFloat(amount) || 0;

  function addPerson() {
    setSplitPeople((prev) => [...prev, { name: "", share: "", settled: false }]);
  }

  function removePerson(idx: number) {
    setSplitPeople((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePerson(idx: number, field: keyof SplitPerson, value: string | boolean) {
    setSplitPeople((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  function splitEqually() {
    if (!totalBillNum || splitPeople.length === 0) return;
    const perPerson = Math.round((totalBillNum / (splitPeople.length + 1)) * 100) / 100;
    setSplitPeople((prev) => prev.map((p) => ({ ...p, share: String(perPerson) })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalAmount = splitEnabled && paidBy === "me" ? myShare : parseFloat(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!item.trim()) { setError("Item is required"); return; }
    if (!category.trim()) { setError("Category is required"); return; }
    if (splitEnabled && totalBillNum <= 0) { setError("Enter the total bill amount"); return; }

    setSaving(true);
    setError("");
    try {
      await ensureCategory(category.trim(), "expense");
      const data: ExpenseData = {
        amount_inr: finalAmount,
        item: item.trim(),
        category: category.trim(),
      };
      if (splitEnabled) {
        data.split = {
          total_amount: totalBillNum,
          paid_by: paidBy === "me" ? "me" : (paidByName.trim() || "other"),
          participants: splitPeople
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              share: parseFloat(p.share) || 0,
              settled: p.settled,
            })),
        };
      }
      if (editing) {
        await updateEntry(editing.id, "expense", data as Record<string, unknown>);
      } else {
        await saveEntry("expense", data as Record<string, unknown>, entryDate);
      }
      setAmount(""); setItem(""); setCategory("");
      setSplitEnabled(false); setTotalBill(""); setSplitPeople([]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount — only shown when split is off or paid_by === "other" */}
      {(!splitEnabled || paidBy === "other") && (
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
      )}

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

      {/* Split toggle */}
      <div className="border-t border-border/50 pt-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div
            onClick={() => setSplitEnabled((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              splitEnabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                splitEnabled ? "translate-x-4" : ""
              }`}
            />
          </div>
          <span className="text-sm font-medium">Split this expense</span>
        </label>
      </div>

      {/* Split details */}
      {splitEnabled && (
        <div className="space-y-3 rounded-xl bg-muted/40 px-4 py-3">
          <div className="space-y-1.5">
            <Label>Total bill (₹)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="600"
              value={totalBill}
              onChange={(e) => setTotalBill(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Paid by</Label>
            <div className="flex gap-2">
              {(["me", "other"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPaidBy(v)}
                  className={`flex-1 min-h-[36px] rounded-lg border text-sm font-medium transition-colors ${
                    paidBy === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {v === "me" ? "Me" : "Someone else"}
                </button>
              ))}
            </div>
            {paidBy === "other" && (
              <Input
                placeholder="Their name"
                value={paidByName}
                onChange={(e) => setPaidByName(e.target.value)}
                className="mt-1.5"
              />
            )}
          </div>

          {/* Other participants */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Others in the split</Label>
              {splitPeople.length > 0 && totalBillNum > 0 && (
                <button
                  type="button"
                  onClick={splitEqually}
                  className="text-xs text-primary hover:underline"
                >
                  Split equally
                </button>
              )}
            </div>
            {splitPeople.map((p, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_90px_28px_28px] gap-1.5 items-center">
                <Input
                  placeholder="Name"
                  value={p.name}
                  onChange={(e) => updatePerson(idx, "name", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  placeholder="₹"
                  value={p.share}
                  onChange={(e) => updatePerson(idx, "share", e.target.value)}
                  className="h-8 text-sm"
                />
                <button
                  type="button"
                  title={p.settled ? "Mark unsettled" : "Mark settled"}
                  onClick={() => updatePerson(idx, "settled", !p.settled)}
                  className={`h-8 w-8 rounded-lg border text-xs transition-colors ${
                    p.settled
                      ? "bg-green-500/20 border-green-500/40 text-green-600"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => removePerson(idx)}
                  className="h-8 w-8 rounded-lg border border-input bg-background text-muted-foreground hover:text-destructive text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPerson}
              className="w-full h-8 text-xs"
            >
              + Add person
            </Button>
          </div>

          {/* My share display */}
          {totalBillNum > 0 && (
            <div className="flex items-center justify-between text-sm rounded-lg bg-muted px-3 py-2">
              <span className="text-muted-foreground">Your share</span>
              <span className="font-semibold tabular-nums">
                ₹{paidBy === "me" ? Math.round(myShare * 100) / 100 : (parseFloat(amount) || 0)}
              </span>
            </div>
          )}
        </div>
      )}

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
