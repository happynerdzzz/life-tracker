import type { Entry, MealData, WorkoutData, CardioData, SleepData } from "./types";

const HEADERS = [
  "day", "date", "time", "type", "name", "kcal", "protein_g", "sets",
  "calories_burned", "duration_min", "intensity", "distance_km",
  "sleep_hours", "sleep_quality", "muscle_groups",
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function getDayName(dateStr: string): string {
  return DAYS[new Date(dateStr + "T00:00:00").getDay()];
}

function toRow(entry: Entry): string {
  const d = entry.data;
  const dayName = getDayName(entry.entry_date);
  switch (entry.type) {
    case "meal": {
      const m = d as unknown as MealData;
      const slot = m.slot
        ? m.slot.charAt(0).toUpperCase() + m.slot.slice(1).replace("_", " ")
        : "";
      return [
        dayName, entry.entry_date, entry.entry_time ?? "", "meal",
        slot ? `${slot} – ${m.name}` : m.name,
        m.total_kcal ?? "", m.total_protein_g ?? "",
        "", "", "", "", "", "", "", "",
      ].map(cell).join(",");
    }
    case "workout": {
      const w = d as unknown as WorkoutData;
      return [
        dayName, entry.entry_date, entry.entry_time ?? "", "workout",
        w.exercise, "", "", w.sets?.length ?? "",
        w.calories_burned ?? "", w.duration_min ?? "",
        "", "", "", "", w.muscle_groups?.join(";") ?? "",
      ].map(cell).join(",");
    }
    case "cardio": {
      const c = d as unknown as CardioData;
      return [
        dayName, entry.entry_date, entry.entry_time ?? "", "cardio",
        c.activity, "", "", "",
        c.calories_burned ?? "", c.duration_min ?? "",
        c.intensity ?? "", c.distance_km ?? "",
        "", "", "",
      ].map(cell).join(",");
    }
    case "sleep": {
      const s = d as unknown as SleepData;
      return [
        dayName, entry.entry_date, entry.entry_time ?? "", "sleep",
        "", "", "", "", "", "", "", "",
        s.hours ?? "", s.quality ?? "", "",
      ].map(cell).join(",");
    }
    default:
      return "";
  }
}

export function generateWeekCSV(entries: Entry[]): string {
  const rows = entries
    .filter((e) => ["meal", "workout", "cardio", "sleep"].includes(e.type))
    .sort((a, b) => {
      const dateComp = a.entry_date.localeCompare(b.entry_date);
      if (dateComp !== 0) return dateComp;
      return (a.entry_time ?? "").localeCompare(b.entry_time ?? "");
    })
    .map(toRow)
    .filter(Boolean);
  return [HEADERS.join(","), ...rows].join("\n");
}
