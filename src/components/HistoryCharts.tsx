"use client";

import {
  ComposedChart,
  Bar,
  Line,
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
import { SectionHeader } from "@/components/ui/section-header";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { CATEGORY } from "@/lib/theme";
import { useState, useMemo } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HistoryEntry = { entry_date: string; type: string; data: Record<string, unknown> };
export type HistoryTarget = { day_type: string; kcal_target: number | null; protein_target_g: number | null };

type Props = { entries: HistoryEntry[]; targets: HistoryTarget[] };

const RANGES = ["7D", "30D", "90D", "All"] as const;
type Range = (typeof RANGES)[number];

const EXPENSE_COLORS = [
  "var(--chart-5)", "#f97316", "#ec4899", "#06b6d4",
  "#8b5cf6", "#10b981", "#ef4444", "#3b82f6",
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
  const days = range === "7D" ? 7 : range === "30D" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().split("T")[0];
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Shared chart primitives ──────────────────────────────────────────────────

const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

function ChartEmpty() {
  return (
    <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
      No data for this range
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

// ─── Segmented range control ──────────────────────────────────────────────────

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const idx = RANGES.indexOf(value);
  return (
    <div className="relative flex gap-0.5 bg-muted rounded-full p-1 w-fit">
      {/* Sliding indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-full bg-card shadow-sm transition-transform duration-200"
        style={{
          width: `calc(${100 / RANGES.length}% - 2px)`,
          left: "4px",
          transform: `translateX(calc(${idx} * 100% + ${idx} * 2px))`,
        }}
      />
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`relative z-10 px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
            value === r ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── Weight chart ─────────────────────────────────────────────────────────────

type WeightPoint = { date: string; kg: number };

function WeightChart({ data }: { data: WeightPoint[] }) {
  if (data.length === 0) return <ChartEmpty />;
  return (
    <ChartScroll count={data.length}>
      <ComposedChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis dataKey="kg" domain={["auto", "auto"]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label ? fmtDate(String(label)) : ""}
              rows={payload?.map((p) => ({ name: "Weight", value: `${p.value} kg`, color: "var(--chart-1)" })) ?? []}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey="kg"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0, fill: "var(--chart-1)" }}
        />
      </ComposedChart>
    </ChartScroll>
  );
}

// ─── Nutrition chart ──────────────────────────────────────────────────────────

type NutritionPoint = { date: string; kcal: number; protein: number; kcal_target: number | null; protein_target: number | null };

function NutritionChart({ data, dataKey, targetKey, unit, color }: {
  data: NutritionPoint[];
  dataKey: "kcal" | "protein";
  targetKey: "kcal_target" | "protein_target";
  unit: string;
  color: string;
}) {
  if (data.length === 0) return <ChartEmpty />;
  const hasTarget = data.some((d) => d[targetKey] !== null);
  return (
    <ChartScroll count={data.length}>
      <ComposedChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label ? fmtDate(String(label)) : ""}
              rows={[
                ...(payload?.filter((p) => p.dataKey === dataKey).map((p) => ({
                  name: dataKey === "kcal" ? "Calories" : "Protein",
                  value: `${p.value} ${unit}`,
                  color,
                })) ?? []),
                ...(hasTarget && payload?.some((p) => p.dataKey === targetKey) ? [{
                  name: "Target",
                  value: `${payload?.find((p) => p.dataKey === targetKey)?.value} ${unit}`,
                  color: "var(--muted-foreground)",
                }] : []),
              ]}
            />
          )}
        />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={32} />
        {hasTarget && (
          <Line
            dataKey={targetKey}
            type="stepAfter"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            connectNulls={false}
          />
        )}
      </ComposedChart>
    </ChartScroll>
  );
}

// ─── Spend donut ──────────────────────────────────────────────────────────────

type DonutSlice = { name: string; value: number };

function SpendDonut({ slices }: { slices: DonutSlice[] }) {
  if (slices.length === 0) return <ChartEmpty />;
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
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
      {/* Total centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="font-mono tabular-nums font-semibold text-lg">₹{Math.round(total)}</p>
      </div>
      {/* Legend below */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
        {slices.map((s, i) => (
          <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sleep heatmap ────────────────────────────────────────────────────────────

type SleepDay = { date: string; hours: number };

function SleepHeatmap({ data, range }: { data: SleepDay[]; range: Range }) {
  if (data.length === 0) return <ChartEmpty />;

  const byDate = new Map(data.map((d) => [d.date, d.hours]));
  const startDate = getStartDate(range);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build calendar grid: weeks × days
  const end = new Date(today);
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date(today);
  if (!startDate) start.setDate(start.getDate() - 89);

  // Align to Monday
  const dow = start.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + offset);

  const cells: { date: string; hours: number | null; future: boolean }[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split("T")[0];
    const future = d > today;
    cells.push({ date: iso, hours: byDate.get(iso) ?? null, future });
  }

  // Chunk into weeks
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

  function cellColor(hours: number | null, future: boolean): string {
    if (future || hours === null) return "var(--muted)";
    const opacity = Math.max(0.15, Math.min(1, hours / 9));
    return `oklch(0.55 0.18 290 / ${opacity})`;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="text-[9px] text-muted-foreground w-3 h-3 flex items-center justify-center">{l}</div>
          ))}
        </div>
        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell, di) => (
              <div
                key={di}
                title={cell.hours !== null ? `${cell.date}: ${cell.hours}h` : cell.date}
                className="size-3 rounded-[2px] cursor-default"
                style={{ backgroundColor: cellColor(cell.hours, cell.future) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2 items-center">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {[0.15, 0.35, 0.55, 0.75, 1].map((op) => (
          <div key={op} className="size-3 rounded-[2px]" style={{ backgroundColor: `oklch(0.55 0.18 290 / ${op})` }} />
        ))}
        <span className="text-[10px] text-muted-foreground">More (9h)</span>
      </div>
    </div>
  );
}

// ─── Workout volume bar ───────────────────────────────────────────────────────

type VolumePoint = { date: string; sets: number };

function WorkoutVolumeChart({ data }: { data: VolumePoint[] }) {
  if (data.length === 0) return <ChartEmpty />;
  return (
    <ChartScroll count={data.length}>
      <ComposedChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} />
        <Tooltip
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label ? fmtDate(String(label)) : ""}
              rows={payload?.map((p) => ({ name: "Sets", value: String(p.value), color: "var(--chart-3)" })) ?? []}
            />
          )}
        />
        <Bar dataKey="sets" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={32} />
      </ComposedChart>
    </ChartScroll>
  );
}

// ─── This week summary ─────────────────────────────────────────────────────────

function WeekSummaryCard({ entries, targets, range }: { entries: HistoryEntry[]; targets: HistoryTarget[]; range: Range }) {
  const startDate = getStartDate(range);
  const filtered = startDate ? entries.filter((e) => e.entry_date >= startDate) : entries;

  const meals = filtered.filter((e) => e.type === "meal");
  const avgKcal = meals.length ? Math.round(meals.reduce((s, e) => s + ((e.data as { total_kcal: number }).total_kcal ?? 0), 0) / new Set(meals.map((e) => e.entry_date)).size) : 0;
  const avgProt = meals.length ? Math.round(meals.reduce((s, e) => s + ((e.data as { total_protein_g: number }).total_protein_g ?? 0), 0) / new Set(meals.map((e) => e.entry_date)).size) : 0;
  const workoutDays = new Set(filtered.filter((e) => e.type === "workout").map((e) => e.entry_date)).size;
  const sleepEntries = filtered.filter((e) => e.type === "sleep");
  const avgSleep = sleepEntries.length ? (sleepEntries.reduce((s, e) => s + ((e.data as { hours: number }).hours ?? 0), 0) / sleepEntries.length).toFixed(1) : "—";

  const target = targets.find((t) => t.day_type === "gym");

  const stats = [
    { label: "Avg Calories", value: avgKcal ? `${avgKcal}` : "—", unit: "kcal", target: target?.kcal_target ? String(target.kcal_target) : null },
    { label: "Avg Protein",  value: avgProt ? `${avgProt}` : "—",  unit: "g",    target: target?.protein_target_g ? String(target.protein_target_g) : null },
    { label: "Workout Days", value: String(workoutDays), unit: "days", target: null },
    { label: "Avg Sleep",    value: String(avgSleep),    unit: "hrs",  target: null },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{s.label}</span>
          <span className="font-mono tabular-nums text-2xl font-semibold leading-none">{s.value}</span>
          <span className="text-[11px] text-muted-foreground">
            {s.unit}{s.target && ` / ${s.target}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HistoryCharts({ entries, targets }: Props) {
  const [range, setRange] = useState<Range>("30D");

  const startDate = getStartDate(range);
  const filtered = useMemo(
    () => (startDate ? entries.filter((e) => e.entry_date >= startDate) : entries),
    [entries, startDate]
  );

  const weightData = useMemo<WeightPoint[]>(
    () => filtered.filter((e) => e.type === "weight").map((e) => ({ date: e.entry_date, kg: (e.data as { kg: number }).kg })),
    [filtered]
  );

  const nutritionData = useMemo<NutritionPoint[]>(() => {
    const byDate = new Map<string, { kcal: number; protein: number }>();
    filtered.filter((e) => e.type === "meal").forEach((e) => {
      const d = e.data as { total_kcal: number; total_protein_g: number };
      const prev = byDate.get(e.entry_date) ?? { kcal: 0, protein: 0 };
      byDate.set(e.entry_date, { kcal: prev.kcal + (d.total_kcal ?? 0), protein: prev.protein + (d.total_protein_g ?? 0) });
    });
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, { kcal, protein }]) => {
      const t = targets.find((x) => x.day_type === getDayType(date));
      return { date, kcal: Math.round(kcal), protein: Math.round(protein), kcal_target: t?.kcal_target ?? null, protein_target: t?.protein_target_g ?? null };
    });
  }, [filtered, targets]);

  const spendSlices = useMemo<DonutSlice[]>(() => {
    const byCat = new Map<string, number>();
    filtered.filter((e) => e.type === "expense").forEach((e) => {
      const d = e.data as { amount_inr: number; category: string };
      byCat.set(d.category, (byCat.get(d.category) ?? 0) + d.amount_inr);
    });
    return Array.from(byCat.entries()).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const sleepData = useMemo<SleepDay[]>(() => {
    const byDate = new Map<string, number>();
    filtered.filter((e) => e.type === "sleep").forEach((e) => {
      const d = e.data as { hours: number };
      byDate.set(e.entry_date, (byDate.get(e.entry_date) ?? 0) + d.hours);
    });
    return Array.from(byDate.entries()).map(([date, hours]) => ({ date, hours }));
  }, [filtered]);

  const volumeData = useMemo<VolumePoint[]>(() => {
    const byDate = new Map<string, number>();
    filtered.filter((e) => e.type === "workout").forEach((e) => {
      const sets = (e.data as { sets?: unknown[] }).sets?.length ?? 0;
      byDate.set(e.entry_date, (byDate.get(e.entry_date) ?? 0) + sets);
    });
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, sets]) => ({ date, sets }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <RangeSelector value={range} onChange={setRange} />
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Today
        </Link>
      </div>

      {/* Top row: weight + week summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="px-4 pb-4 pt-3">
            <SectionHeader title="Weight trend" className="mb-3" />
            <WeightChart data={weightData} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 pb-4 pt-3">
            <SectionHeader title={`${range} summary`} className="mb-3" />
            <WeekSummaryCard entries={filtered} targets={targets} range={range} />
          </CardContent>
        </Card>
      </div>

      {/* Calories */}
      <Card>
        <CardContent className="px-4 pb-4 pt-3">
          <SectionHeader title="Calories vs target" className="mb-3" />
          <NutritionChart data={nutritionData} dataKey="kcal" targetKey="kcal_target" unit="kcal" color={CATEGORY.meal.hue} />
        </CardContent>
      </Card>

      {/* Protein + Workout volume */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="px-4 pb-4 pt-3">
            <SectionHeader title="Protein" className="mb-3" />
            <NutritionChart data={nutritionData} dataKey="protein" targetKey="protein_target" unit="g" color={CATEGORY.weight.hue} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 pb-4 pt-3">
            <SectionHeader title="Workout volume" className="mb-3" />
            <WorkoutVolumeChart data={volumeData} />
          </CardContent>
        </Card>
      </div>

      {/* Sleep heatmap + Spend donut */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="px-4 pb-4 pt-3">
            <SectionHeader title="Sleep" className="mb-3" />
            <SleepHeatmap data={sleepData} range={range} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 pb-4 pt-3">
            <SectionHeader title="Spend by category" className="mb-3" />
            <SpendDonut slices={spendSlices} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
