"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { fetchEntriesRange, deleteEntry } from "@/lib/api";
import type { Entry, ExpenseData } from "@/lib/types";
import StatementPreviewModal from "./StatementPreviewModal";
import ExpenseForm from "./forms/ExpenseForm";
import type { StatementRow } from "@/app/api/statements/route";

const EXPENSE_COLORS = [
  "var(--chart-5)", "#f97316", "#ec4899", "#06b6d4",
  "#8b5cf6", "#10b981", "#ef4444", "#3b82f6",
];

const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function monthBounds(year: number, month: number) {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { first, last };
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function fmtMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// ─── Shared chart primitives ──────────────────────────────────────────────────

function ChartEmpty() {
  return (
    <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
      No expense data for this period
    </div>
  );
}

function ChartScroll({ count, height = 200, children }: { count: number; height?: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div style={{ minWidth: count > 14 ? count * 34 : "100%" }}>
        <ResponsiveContainer width="100%" height={height}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

type DonutSlice = { name: string; value: number };

function SpendDonut({ slices }: { slices: DonutSlice[] }) {
  if (slices.length === 0) return <ChartEmpty />;
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="85%"
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  rows={payload?.map((p, i) => ({
                    name: String(p.name),
                    value: `₹${Math.round(Number(p.value))}`,
                    color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
                  })) ?? []}
                />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-mono tabular-nums font-semibold text-lg">₹{Math.round(total)}</p>
        </div>
      </div>

      {/* Category bar list */}
      <div className="space-y-1.5 mt-3">
        {slices.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.name} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm shrink-0" style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                  <span className="text-foreground">{s.name}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums text-muted-foreground">
                  <span>₹{Math.round(s.value)}</span>
                  <span className="text-muted-foreground/60 w-8 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Daily bar chart ──────────────────────────────────────────────────────────

type DayPoint = { day: number; [category: string]: number };

function DailyBarChart({ entries, categories }: { entries: Entry[]; categories: string[] }) {
  if (entries.length === 0) return <ChartEmpty />;

  const byDay = new Map<number, Record<string, number>>();
  for (const e of entries) {
    const day = parseInt(e.entry_date.slice(8), 10);
    const d = e.data as ExpenseData;
    if (!byDay.has(day)) byDay.set(day, {});
    const bucket = byDay.get(day)!;
    bucket[d.category] = (bucket[d.category] ?? 0) + d.amount_inr;
  }

  const data: DayPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, cats]) => ({ day, ...cats }));

  return (
    <ChartScroll count={data.length}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `₹${v}`} />
        <Tooltip
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label ? `Day ${label}` : ""}
              rows={payload?.map((p, i) => ({
                name: String(p.dataKey),
                value: `₹${Math.round(Number(p.value))}`,
                color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
              })) ?? []}
            />
          )}
        />
        {categories.map((cat, i) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
            radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={32}
          />
        ))}
      </BarChart>
    </ChartScroll>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  onEdit: (e: Entry) => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const d = entry.data as ExpenseData;

  return (
    <tr className="group border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 pl-4 pr-2 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
        {entry.entry_date}
      </td>
      <td className="py-2.5 px-2 text-sm max-w-[140px] truncate">
        {d.item}
        {d.split && <span className="ml-1 text-[10px] text-muted-foreground/70">split</span>}
      </td>
      <td className="py-2.5 px-2 text-xs text-muted-foreground hidden sm:table-cell">
        {d.category}
      </td>
      <td className="py-2.5 px-2 text-sm tabular-nums font-mono text-right">
        ₹{Math.round(d.amount_inr)}
      </td>
      <td className="py-2.5 pl-2 pr-4 text-right">
        {!confirming ? (
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity sm:flex-row">
            <button
              onClick={() => onEdit(entry)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Edit"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs px-2"
              onClick={() => { setConfirming(false); onDelete(entry.id); }}
            >
              Delete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prevEntries, setPrevEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Statement import state
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importedRows, setImportedRows] = useState<StatementRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // CRUD state
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const today = todayIST();

  async function reloadEntries() {
    const { first, last } = monthBounds(year, month);
    const prev = prevMonth(year, month);
    const { first: prevFirst, last: prevLast } = monthBounds(prev.year, prev.month);
    const [curr, prevData] = await Promise.all([
      fetchEntriesRange(first, last, "expense"),
      fetchEntriesRange(prevFirst, prevLast, "expense"),
    ]);
    setEntries(curr);
    setPrevEntries(prevData);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { first, last } = monthBounds(year, month);
      const prev = prevMonth(year, month);
      const { first: prevFirst, last: prevLast } = monthBounds(prev.year, prev.month);
      const [curr, prevData] = await Promise.all([
        fetchEntriesRange(first, last, "expense"),
        fetchEntriesRange(prevFirst, prevLast, "expense"),
      ]);
      if (!cancelled) { setEntries(curr); setPrevEntries(prevData); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [year, month]);

  function goToPrev() {
    const p = prevMonth(year, month);
    setYear(p.year); setMonth(p.month);
  }

  function goToNext() {
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const { first } = monthBounds(nextY, nextM);
    if (first > today) return;
    setYear(nextY); setMonth(nextM);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const totalSpend = useMemo(
    () => entries.reduce((s, e) => s + ((e.data as ExpenseData).amount_inr ?? 0), 0),
    [entries]
  );
  const prevTotalSpend = useMemo(
    () => prevEntries.reduce((s, e) => s + ((e.data as ExpenseData).amount_inr ?? 0), 0),
    [prevEntries]
  );
  const delta = prevTotalSpend > 0 ? ((totalSpend - prevTotalSpend) / prevTotalSpend) * 100 : null;

  const spendSlices = useMemo<DonutSlice[]>(() => {
    const byCat = new Map<string, number>();
    entries.forEach((e) => {
      const d = e.data as ExpenseData;
      byCat.set(d.category, (byCat.get(d.category) ?? 0) + d.amount_inr);
    });
    return Array.from(byCat.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  const categories = useMemo(() => spendSlices.map((s) => s.name), [spendSlices]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries]
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/statements", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Failed to parse statement"); return; }
      if (data.transactions.length === 0) {
        setImportError("No expense transactions found in this PDF.");
        return;
      }
      setImportedRows(data.transactions);
    } catch {
      setImportError("Network error. Try again.");
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleImportSaved() {
    setImportedRows(null);
    await reloadEntries();
  }

  async function handleDelete(id: string) {
    await deleteEntry(id);
    await reloadEntries();
  }

  async function handleEditSaved() {
    setEditingEntry(null);
    await reloadEntries();
  }

  async function handleAddSaved() {
    setAddingNew(false);
    await reloadEntries();
  }

  // entryDate for "add new": first day of selected month, capped at today
  const addEntryDate = useMemo(() => {
    const { first } = monthBounds(year, month);
    return first > today ? today : first;
  }, [year, month, today]);

  return (
    <div className="space-y-6">
      {/* Month navigation + import button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="font-semibold text-sm w-36 text-center">{fmtMonthLabel(year, month)}</span>
          <button
            onClick={goToNext}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        {/* Import statement */}
        <div className="flex flex-col items-end gap-1">
          <label className="cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={handleFileChange}
              disabled={importLoading}
            />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer">
              {importLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  Parsing…
                </span>
              ) : (
                "↑ Import statement"
              )}
            </span>
          </label>
          {importError && <p className="text-xs text-destructive max-w-[200px] text-right">{importError}</p>}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Total spend</p>
                <p className="font-mono font-semibold text-lg tabular-nums">₹{Math.round(totalSpend)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">vs last month</p>
                {delta !== null ? (
                  <p className={`font-semibold text-lg tabular-nums ${delta > 0 ? "text-destructive" : "text-green-500"}`}>
                    {delta > 0 ? "+" : ""}{Math.round(delta)}%
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">—</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                <p className="font-semibold text-lg">{entries.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Category breakdown */}
          <Card>
            <CardContent className="px-4 pb-4 pt-3">
              <SectionHeader title="Spend by category" className="mb-4" />
              <SpendDonut slices={spendSlices} />
            </CardContent>
          </Card>

          {/* Daily breakdown */}
          <Card>
            <CardContent className="px-4 pb-4 pt-3">
              <SectionHeader title="Daily spend" className="mb-3" />
              <DailyBarChart entries={entries} categories={categories} />
            </CardContent>
          </Card>

          {/* Transactions table */}
          <Card>
            <CardContent className="px-4 pb-4 pt-3">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader title="Transactions" />
                <button
                  onClick={() => setAddingNew(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Add transaction
                </button>
              </div>

              {sortedEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No transactions this month</p>
              ) : (
                <div className="overflow-x-auto -mx-4 px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="py-2 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                        <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                        <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                        <th className="py-2 px-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="py-2 pl-2 pr-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map((entry) => (
                        <TransactionRow
                          key={entry.id}
                          entry={entry}
                          onEdit={setEditingEntry}
                          onDelete={handleDelete}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Statement preview modal */}
      {importedRows && (
        <StatementPreviewModal
          transactions={importedRows}
          onSaved={handleImportSaved}
          onCancel={() => setImportedRows(null)}
        />
      )}

      {/* Edit modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-semibold text-lg mb-4">Edit transaction</h2>
            <ExpenseForm
              editing={editingEntry}
              onSaved={handleEditSaved}
              onCancelEdit={() => setEditingEntry(null)}
            />
          </div>
        </div>
      )}

      {/* Add new modal */}
      {addingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Add transaction</h2>
              <button
                onClick={() => setAddingNew(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ExpenseForm
              entryDate={addEntryDate}
              onSaved={handleAddSaved}
              onCancelEdit={() => setAddingNew(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
