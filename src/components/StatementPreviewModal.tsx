"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveEntry } from "@/lib/api";
import type { StatementRow } from "@/app/api/statements/route";

type Row = StatementRow & { checked: boolean };

type Props = {
  transactions: StatementRow[];
  onSaved: () => void;
  onCancel: () => void;
};

export default function StatementPreviewModal({ transactions, onSaved, onCancel }: Props) {
  const [rows, setRows] = useState<Row[]>(
    transactions.map((t) => ({ ...t, checked: true }))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const allChecked = rows.every((r) => r.checked);
  const checkedCount = rows.filter((r) => r.checked).length;

  function toggleAll() {
    setRows((prev) => prev.map((r) => ({ ...r, checked: !allChecked })));
  }

  function toggleRow(idx: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)));
  }

  function updateRow(idx: number, field: keyof StatementRow, value: string | number) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  async function handleSave() {
    const selected = rows.filter((r) => r.checked);
    if (selected.length === 0) { onCancel(); return; }
    setSaving(true);
    setSaveError("");
    let failed = 0;
    for (const row of selected) {
      try {
        await saveEntry("expense", { amount_inr: row.amount_inr, item: row.description, category: row.category }, row.date);
      } catch {
        failed++;
      }
    }
    setSaving(false);
    if (failed > 0) {
      setSaveError(`${failed} transaction${failed > 1 ? "s" : ""} failed to save. The rest were saved.`);
    } else {
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div>
            <h2 className="font-semibold text-base">Review transactions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{transactions.length} found · uncheck any to skip</p>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-xl leading-none p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {/* Column headers */}
          <div className="grid grid-cols-[32px_90px_1fr_100px_110px] gap-2 text-xs text-muted-foreground font-medium mb-2 px-1">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-primary"
              />
            </label>
            <span>Date</span>
            <span>Description</span>
            <span>Category</span>
            <span className="text-right">Amount (₹)</span>
          </div>

          <div className="space-y-1.5">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-[32px_90px_1fr_100px_110px] gap-2 items-center rounded-lg px-1 py-1.5 transition-colors ${
                  row.checked ? "bg-muted/30" : "opacity-40"
                }`}
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={() => toggleRow(idx)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                </label>
                <span className="text-xs tabular-nums text-muted-foreground">{row.date}</span>
                <Input
                  value={row.description}
                  onChange={(e) => updateRow(idx, "description", e.target.value)}
                  className="h-7 text-xs"
                  disabled={!row.checked}
                />
                <Input
                  value={row.category}
                  onChange={(e) => updateRow(idx, "category", e.target.value)}
                  className="h-7 text-xs"
                  disabled={!row.checked}
                />
                <Input
                  type="number"
                  value={row.amount_inr}
                  onChange={(e) => updateRow(idx, "amount_inr", parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs text-right"
                  disabled={!row.checked}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-4 shrink-0 space-y-2">
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1 min-h-[44px]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || checkedCount === 0}
              className="flex-1 min-h-[44px]"
            >
              {saving
                ? "Saving…"
                : `Save ${checkedCount} transaction${checkedCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
