"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import type { StreakRow } from "@/app/api/streaks/route";

const HABIT_META: Record<string, { label: string; color: string }> = {
  log_anything:       { label: "Daily logging",    color: "var(--chart-1)" },
  meal_logged:        { label: "Meals logged",      color: "var(--chart-2)" },
  workout_on_gym_day: { label: "Gym days hit",      color: "var(--chart-3)" },
  sleep_logged:       { label: "Sleep logged",      color: "var(--chart-4)" },
  within_kcal_target: { label: "Kcal target met",   color: "var(--chart-5)" },
};

const ORDER = ["log_anything", "meal_logged", "workout_on_gym_day", "sleep_logged", "within_kcal_target"];

export default function StreaksCard() {
  const [streaks, setStreaks] = useState<StreakRow[]>([]);

  useEffect(() => {
    fetch("/api/streaks")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStreaks(data); })
      .catch(() => {});
  }, []);

  if (streaks.length === 0) return null;

  const sorted = ORDER.map((key) => streaks.find((s) => s.habit_key === key)).filter(Boolean) as StreakRow[];

  return (
    <Card>
      <CardContent className="px-4 pb-4 pt-3">
        <SectionHeader title="Streaks" className="mb-3" />
        <div className="space-y-3">
          {sorted.map((streak) => {
            const meta = HABIT_META[streak.habit_key];
            if (!meta) return null;
            const pct = streak.longest_streak > 0
              ? Math.min(streak.current_streak / streak.longest_streak, 1)
              : 0;
            return (
              <div key={streak.habit_key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{meta.label}</span>
                  <div className="flex items-center gap-3 text-[11px] tabular-nums">
                    <span className="font-semibold">
                      {streak.current_streak}
                      {streak.current_streak >= 3 && " 🔥"}
                    </span>
                    <span className="text-muted-foreground/60">best {streak.longest_streak}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(pct * 100)}%`,
                      backgroundColor: meta.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
