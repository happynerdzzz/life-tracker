"use client";

import { useState, useEffect } from "react";
import { Ring } from "@/components/ui/ring";
import type { StreakRow } from "@/app/api/streaks/route";

const HABIT_META: Record<string, { label: string; emoji: string; color: string }> = {
  log_anything:       { label: "Logging",  emoji: "📅", color: "var(--chart-1)" },
  meal_logged:        { label: "Meals",    emoji: "🍽️", color: "var(--chart-2)" },
  workout_on_gym_day: { label: "Gym days", emoji: "🏋️", color: "var(--chart-3)" },
  sleep_logged:       { label: "Sleep",    emoji: "😴", color: "var(--chart-4)" },
  within_kcal_target: { label: "Kcal goal",emoji: "🎯", color: "var(--chart-5)" },
};

const ORDER = ["log_anything", "meal_logged", "workout_on_gym_day", "sleep_logged", "within_kcal_target"];

export default function StreakStrip() {
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
    <div className="flex gap-3 overflow-x-auto py-1 -mx-1 px-1">
      {sorted.map((streak) => {
        const meta = HABIT_META[streak.habit_key];
        if (!meta) return null;
        const today = new Date().toISOString().split("T")[0];
        const isToday = streak.last_qualified === today;
        const pct = streak.longest_streak > 0 ? Math.min(streak.current_streak / streak.longest_streak, 1) : 0;

        return (
          <div key={streak.habit_key} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="relative">
              <Ring
                value={Math.round(pct * 100)}
                max={100}
                size={40}
                stroke={4}
                color={isToday ? meta.color : "var(--muted-foreground)"}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[11px]">
                {isToday ? "✓" : "·"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground text-center leading-tight w-12 truncate">{meta.label}</p>
            <p className="text-[10px] font-mono tabular-nums font-semibold text-center leading-none">
              {streak.current_streak}
              {streak.current_streak >= 3 && <span> 🔥</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
