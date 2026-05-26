import type { Entry } from "./types";

const today = () => new Date().toISOString().split("T")[0];
const now = () => new Date().toTimeString().slice(0, 8);

export async function saveEntry(
  type: string,
  data: Record<string, unknown>,
  date?: string
): Promise<Entry> {
  const res = await fetch("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry_date: date ?? today(),
      entry_time: now(),
      type,
      source: "form",
      data,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to save entry");
  }
  return res.json();
}

export async function updateEntry(
  id: string,
  type: string,
  data: Record<string, unknown>
): Promise<Entry> {
  const res = await fetch(`/api/entries/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, data, source: "manual_edit" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update entry");
  }
  return res.json();
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete entry");
}

export async function fetchEntries(date: string): Promise<Entry[]> {
  const res = await fetch(`/api/entries?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch entries");
  return res.json();
}

export async function fetchExercises(): Promise<{ id: string; name: string; muscle_groups: string[] | null }[]> {
  const res = await fetch("/api/exercises");
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCategories(kind?: string): Promise<{ id: string; name: string; kind: string }[]> {
  const url = kind ? `/api/categories?kind=${kind}` : "/api/categories";
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function ensureCategory(name: string, kind: string): Promise<void> {
  await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, kind }),
  });
}

export async function fetchTargets(): Promise<{ day_type: string; kcal_target: number; protein_target_g: number }[]> {
  const res = await fetch("/api/targets");
  if (!res.ok) return [];
  return res.json();
}

export function getDayType(date: Date): "gym" | "rest" | "weekend" {
  const dow = date.getDay(); // 0=Sun,1=Mon,...,6=Sat
  if (dow === 0 || dow === 6) return "weekend";
  if (dow === 1 || dow === 3 || dow === 5) return "gym"; // Mon, Wed, Fri
  return "rest"; // Tue, Thu
}
