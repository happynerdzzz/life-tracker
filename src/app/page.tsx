"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import TodayView from "@/components/TodayView";
import DumpDayBox from "@/components/DumpDayBox";
import WeightForm from "@/components/forms/WeightForm";
import MealForm from "@/components/forms/MealForm";
import WorkoutForm from "@/components/forms/WorkoutForm";
import CardioForm from "@/components/forms/CardioForm";
import SleepForm from "@/components/forms/SleepForm";
import ExpenseForm from "@/components/forms/ExpenseForm";

type FormType = "dump" | "weight" | "meal" | "workout" | "cardio" | "sleep" | "expense" | null;

const DOCK_ITEMS: { id: FormType; label: string; emoji: string }[] = [
  { id: "weight",  label: "Weight",  emoji: "⚖️" },
  { id: "meal",    label: "Meal",    emoji: "🍽️" },
  { id: "workout", label: "Workout", emoji: "🏋️" },
  { id: "cardio",  label: "Cardio",  emoji: "🏊" },
  { id: "sleep",   label: "Sleep",   emoji: "😴" },
  { id: "expense", label: "Spend",   emoji: "💸" },
];

const FORM_TITLES: Record<string, string> = {
  weight: "Log weight",
  meal: "Log meal",
  workout: "Log workout",
  cardio: "Log cardio",
  sleep: "Log sleep",
  expense: "Log expense",
};

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [dumpOpen, setDumpOpen] = useState(false);
  const [logDate, setLogDate] = useState(todayIST);

  const today = todayIST();
  const isToday = logDate === today;

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function closeForm() {
    setActiveForm(null);
  }

  function handleFormSaved() {
    closeForm();
    refresh();
  }

  function handleDumpSaved() {
    setDumpOpen(false);
    refresh();
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/60 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <h1 className="font-semibold text-lg tracking-tight">Life Tracker</h1>
          <nav className="flex items-center gap-4">
            <Link href="/goals" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Goals
            </Link>
            <Link href="/exercises" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Exercises
            </Link>
            <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              History
            </Link>
            <Link href="/finance" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Finance
            </Link>
            <Link href="/review" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Review
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {/* Date selector */}
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-muted-foreground shrink-0">Logging for</span>
          <input
            type="date"
            value={logDate}
            max={today}
            onChange={(e) => e.target.value && setLogDate(e.target.value)}
            className="text-sm bg-muted/50 rounded-lg px-3 py-1.5 border-0 outline-none
                       focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
          />
          {!isToday && (
            <button
              onClick={() => setLogDate(today)}
              className="text-xs text-primary font-medium hover:underline shrink-0"
            >
              Back to today
            </button>
          )}
        </div>

        <TodayView refreshKey={refreshKey} logDate={logDate} />
      </main>

      {/* Fixed bottom quick-add dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-card/80 backdrop-blur-xl border border-border/60 rounded-full shadow-lg px-2 py-1.5">
        {/* Dump day — primary pill */}
        <button
          onClick={() => setDumpOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium transition-all hover:bg-primary/90 active:scale-95"
        >
          <span>✨</span>
          <span className="hidden sm:inline">Dump day</span>
        </button>

        <div className="w-px h-5 bg-border/60 mx-0.5" />

        {/* Individual entry pills */}
        {DOCK_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveForm(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
            aria-label={item.label}
          >
            <span>{item.emoji}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Individual form bottom sheets */}
      {DOCK_ITEMS.map((item) => (
        <Sheet key={item.id} open={activeForm === item.id} onOpenChange={(o) => !o && closeForm()}>
          <SheetContent title={FORM_TITLES[item.id!]}>
            <div className="px-5 pb-6 pt-3">
              {item.id === "weight"  && <WeightForm  onSaved={handleFormSaved} onCancelEdit={closeForm} entryDate={logDate} />}
              {item.id === "meal"    && <MealForm    onSaved={handleFormSaved} onCancelEdit={closeForm} entryDate={logDate} />}
              {item.id === "workout" && <WorkoutForm onSaved={handleFormSaved} onCancelEdit={closeForm} entryDate={logDate} />}
              {item.id === "cardio"  && <CardioForm  onSaved={handleFormSaved} onCancelEdit={closeForm} entryDate={logDate} />}
              {item.id === "sleep"   && <SleepForm   onSaved={handleFormSaved} onCancelEdit={closeForm} entryDate={logDate} />}
              {item.id === "expense" && <ExpenseForm onSaved={handleFormSaved} onCancelEdit={closeForm} entryDate={logDate} />}
            </div>
          </SheetContent>
        </Sheet>
      ))}

      {/* Dump day bottom sheet */}
      <Sheet open={dumpOpen} onOpenChange={setDumpOpen}>
        <SheetContent title="Dump your day">
          <div className="px-5 pb-6 pt-2">
            <DumpDayBox onSaved={handleDumpSaved} entryDate={logDate} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
