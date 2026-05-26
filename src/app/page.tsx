"use client";

import { useState } from "react";
import Link from "next/link";
import DumpDayBox from "@/components/DumpDayBox";
import FormCard from "@/components/FormCard";
import TodayView from "@/components/TodayView";
import WeightForm from "@/components/forms/WeightForm";
import MealForm from "@/components/forms/MealForm";
import WorkoutForm from "@/components/forms/WorkoutForm";
import SleepForm from "@/components/forms/SleepForm";
import ExpenseForm from "@/components/forms/ExpenseForm";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg tracking-tight">Life Tracker</h1>
          <nav className="flex items-center gap-4">
            <Link
              href="/exercises"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Exercises
            </Link>
            <Link
              href="/history"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              History
            </Link>
            <Link
              href="/review"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Review
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* LLM dump box */}
        <DumpDayBox onSaved={refresh} />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t" />
          <span className="text-xs text-muted-foreground">or add individually</span>
          <div className="flex-1 border-t" />
        </div>

        {/* Quick-entry forms */}
        <section className="space-y-2">
          <FormCard title="Weight" icon="⚖️">
            <WeightForm onSaved={refresh} />
          </FormCard>
          <FormCard title="Meal" icon="🍽️">
            <MealForm onSaved={refresh} />
          </FormCard>
          <FormCard title="Workout" icon="🏋️">
            <WorkoutForm onSaved={refresh} />
          </FormCard>
          <FormCard title="Sleep" icon="😴">
            <SleepForm onSaved={refresh} />
          </FormCard>
          <FormCard title="Expense" icon="💸">
            <ExpenseForm onSaved={refresh} />
          </FormCard>
        </section>

        {/* Today view */}
        <section>
          <TodayView refreshKey={refreshKey} />
        </section>
      </main>
    </div>
  );
}
