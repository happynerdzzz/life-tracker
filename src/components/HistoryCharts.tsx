"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HistoryEntry = {
  entry_date: string;
  type: string;
  data: Record<string, unknown>;
};

export type HistoryTarget = {
  day_type: string;
  kcal_target: number | null;
  protein_target_g: number | null;
};

type Props = {
  entries: HistoryEntry[];
  targets: HistoryTarget[];
};

const RANGES = ["7d", "30d", "90d", "All"] as const;
type Range = (typeof RANGES)[number];

const EXPENSE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDayType(dateStr: string): "gym" | "rest" | "weekend" {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  if (dow === 0 || dow === 6) return "weekend";
  if (dow === 1 || dow === 3 || dow === 5) return "gym";
  return "rest";
}

function getStartDate(range: Range): string | null {
  if (range === "All") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().split("T")[0];
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ─── Shared chart primitives ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      No data yet for this range
    </div>
  );
}

function ChartScroll({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div style={{ minWidth: count > 14 ? count * 34 : "100%" }}>
        {children}
      </div>
    </div>
  );
}

const sharedXAxis = (
  <XAxis
    dataKey="date"
    tickFormatter={fmtDate}
    tick={{ fontSize: 11 }}
    tickLine={false}
    axisLine={false}
    interval="preserveStartEnd"
  />
);

const sharedYAxis = (
  <YAxis
    tick={{ fontSize: 11 }}
    tickLine={false}
    axisLine={false}
    width={44}
  />
);

function sharedTooltip(formatter?: (v: number, name: string) => string) {
  return (
    <Tooltip
      contentStyle={{ fontSize: 12, borderRadius: 8 }}
      labelFormatter={(l) => fmtDate(String(l))}
      formatter={formatter ? (value, name) => [formatter(Number(value), String(name)), name] : undefined}
    />
  );
}

// ─── Weight chart ─────────────────────────────────────────────────────────────

type WeightPoint = { date: string; kg: number };

function WeightChart({ data }: { data: WeightPoint[] }) {
  if (data.length === 0) return <EmptyState />;
  return (
    <ChartScroll count={data.length}>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          {sharedXAxis}
          <YAxis
            dataKey="kg"
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          {sharedTooltip((v) => `${v} kg`)}
          <Line
            type="monotone"
            dataKey="kg"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3, fill: "#2563eb" }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartScroll>
  );
}

// ─── Nutrition chart (calories or protein) ────────────────────────────────────

type NutritionPoint = {
  date: string;
  kcal: number;
  protein: number;
  kcal_target: number | null;
  protein_target: number | null;
};

function NutritionChart({
  data,
  dataKey,
  targetKey,
  unit,
  color,
}: {
  data: NutritionPoint[];
  dataKey: "kcal" | "protein";
  targetKey: "kcal_target" | "protein_target";
  unit: string;
  color: string;
}) {
  if (data.length === 0) return <EmptyState />;
  const hasTarget = data.some((d) => d[targetKey] !== null);
  return (
    <ChartScroll count={data.length}>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          {sharedXAxis}
          {sharedYAxis}
          {sharedTooltip((v, name) =>
            name === dataKey ? `${v} ${unit}` : `${v} ${unit} (target)`
          )}
          <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} />
          {hasTarget && (
            <Line
              dataKey={targetKey}
              type="stepAfter"
              stroke="#9ca3af"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartScroll>
  );
}

// ─── Expense chart ───────────────────────────────────────────────────────────

type ExpensePoint = { date: string; total: number } & Record<string, number | string>;

function ExpenseChart({
  data,
  categories,
}: {
  data: ExpensePoint[];
  categories: string[];
}) {
  if (data.length === 0) return <EmptyState />;
  return (
    <>
      <ChartScroll count={data.length}>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            {sharedXAxis}
            {sharedYAxis}
            {sharedTooltip((v, name) =>
              name === "total" ? `₹${v}` : `₹${v}`
            )}
            {categories.map((cat, i) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="stack"
                fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
                radius={i === categories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={36}
              />
            ))}
            {/* Invisible line carries total labels above each stack */}
            <Line
              dataKey="total"
              stroke="transparent"
              strokeWidth={0}
              dot={false}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
              label={({
                x,
                y,
                value,
              }: {
                x?: string | number;
                y?: string | number;
                value?: unknown;
              }) => {
                const px = Number(x ?? 0);
                const py = Number(y ?? 0);
                const v = Number(value ?? 0);
                return v > 0 ? (
                  <text key={`lbl-${px}`} x={px} y={py - 4} textAnchor="middle" fontSize={10} fill="#6b7280">
                    ₹{v}
                  </text>
                ) : (
                  <text key={`lbl-${px}`} />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartScroll>

      {/* Category legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
        {categories.map((cat, i) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2.5 rounded-sm shrink-0"
              style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }}
            />
            {cat}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HistoryCharts({ entries, targets }: Props) {
  const [range, setRange] = useState<Range>("30d");

  const startDate = getStartDate(range);
  const filtered = useMemo(
    () => (startDate ? entries.filter((e) => e.entry_date >= startDate) : entries),
    [entries, startDate]
  );

  const weightData = useMemo<WeightPoint[]>(
    () =>
      filtered
        .filter((e) => e.type === "weight")
        .map((e) => ({
          date: e.entry_date,
          kg: (e.data as { kg: number }).kg,
        })),
    [filtered]
  );

  const nutritionData = useMemo<NutritionPoint[]>(() => {
    const byDate = new Map<string, { kcal: number; protein: number }>();
    filtered
      .filter((e) => e.type === "meal")
      .forEach((e) => {
        const d = e.data as { total_kcal: number; total_protein_g: number };
        const prev = byDate.get(e.entry_date) ?? { kcal: 0, protein: 0 };
        byDate.set(e.entry_date, {
          kcal: prev.kcal + (d.total_kcal ?? 0),
          protein: prev.protein + (d.total_protein_g ?? 0),
        });
      });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { kcal, protein }]) => {
        const dayType = getDayType(date);
        const t = targets.find((x) => x.day_type === dayType);
        return {
          date,
          kcal: Math.round(kcal),
          protein: Math.round(protein),
          kcal_target: t?.kcal_target ?? null,
          protein_target: t?.protein_target_g ?? null,
        };
      });
  }, [filtered, targets]);

  const { expenseData, expenseCategories } = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    const cats = new Set<string>();

    filtered
      .filter((e) => e.type === "expense")
      .forEach((e) => {
        const d = e.data as { amount_inr: number; category: string };
        cats.add(d.category);
        const prev = byDate.get(e.entry_date) ?? {};
        byDate.set(e.entry_date, {
          ...prev,
          [d.category]: (prev[d.category] ?? 0) + (d.amount_inr ?? 0),
        });
      });

    const rows: ExpensePoint[] = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, catAmounts]) => ({
        date,
        total: Math.round(Object.values(catAmounts).reduce((s, v) => s + v, 0)),
        ...Object.fromEntries(
          Object.entries(catAmounts).map(([k, v]) => [k, Math.round(v)])
        ),
      }));

    return { expenseData: rows, expenseCategories: Array.from(cats) };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              range === r
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <Tabs defaultValue="weight">
        <TabsList>
          <TabsTrigger value="weight">Weight</TabsTrigger>
          <TabsTrigger value="calories">Calories</TabsTrigger>
          <TabsTrigger value="protein">Protein</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="weight">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Body weight (kg)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <WeightChart data={weightData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calories">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Daily calories (kcal)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <NutritionChart
                data={nutritionData}
                dataKey="kcal"
                targetKey="kcal_target"
                unit="kcal"
                color="#15803d"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protein">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Daily protein (g)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <NutritionChart
                data={nutritionData}
                dataKey="protein"
                targetKey="protein_target"
                unit="g"
                color="#2563eb"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Daily expenses (₹)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ExpenseChart data={expenseData} categories={expenseCategories} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
