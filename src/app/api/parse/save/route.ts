import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { ParsedEntrySchema, type ParsedEntry } from "@/lib/parser/schema";

const SaveBodySchema = z.object({
  entries: z.array(ParsedEntrySchema),
  entry_date: z.string(),
  raw_text: z.string(),
  new_items: z.object({
    foods: z.array(z.string()),
    exercises: z.array(z.string()),
    categories: z.array(z.string()),
  }),
});

function entryToRow(entry: ParsedEntry, entryDate: string, rawText: string) {
  const { type, ...data } = entry;
  return {
    entry_date: entryDate,
    entry_time: null,
    type,
    raw_text: rawText,
    source: "parser" as const,
    data,
  };
}

function findFoodInEntries(entries: ParsedEntry[], foodName: string) {
  for (const e of entries) {
    if (e.type === "meal") {
      const item = e.items.find((i) => i.food === foodName);
      if (item) return item;
    }
  }
  return null;
}

function findExerciseMuscleGroups(entries: ParsedEntry[], exerciseName: string): string[] {
  for (const e of entries) {
    if (e.type === "workout" && e.exercise === exerciseName) {
      return e.muscle_groups;
    }
  }
  return [];
}

export async function POST(req: NextRequest) {
  const rawBody = await req.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SaveBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", validation_errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { entries, entry_date, raw_text, new_items } = parsed.data;
  const supabase = createServerClient();

  // 1. Batch insert all entries (atomic)
  const rows = entries.map((e) => entryToRow(e, entry_date, raw_text));
  const { data: savedEntries, error: insertError } = await supabase
    .from("entries")
    .insert(rows)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 2. Upsert new foods
  for (const foodName of new_items.foods) {
    const item = findFoodInEntries(entries, foodName);
    await supabase.from("foods").upsert(
      {
        name: foodName,
        kcal_per_serving: item?.kcal ?? null,
        protein_g_per_serving: item?.protein_g ?? null,
        typical_serving: item?.qty ?? null,
        last_calibrated_at: new Date().toISOString(),
      },
      { onConflict: "name" }
    );
  }

  // 3. Upsert new exercises
  for (const exerciseName of new_items.exercises) {
    const muscleGroups = findExerciseMuscleGroups(entries, exerciseName);
    await supabase.from("exercises").upsert(
      { name: exerciseName, muscle_groups: muscleGroups },
      { onConflict: "name" }
    );
  }

  // 4. Upsert new categories (expense kind by default)
  for (const categoryName of new_items.categories) {
    await supabase
      .from("categories")
      .upsert({ name: categoryName, kind: "expense" }, { onConflict: "name,kind" });
  }

  // fire-and-forget streak recompute
  const base = req.nextUrl.origin;
  fetch(`${base}/api/streaks`, { method: "POST" }).catch(() => {});

  return NextResponse.json({
    saved: savedEntries?.length ?? 0,
    ids: savedEntries?.map((e) => e.id) ?? [],
  });
}
