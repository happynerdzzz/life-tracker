import { z } from "zod";

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

export const ParsedMealItemSchema = z.object({
  food: z.string(),
  qty: z.string(),
  kcal: z.number().min(0),
  protein_g: z.number().min(0),
  match_note: z.string().nullish(),
});
export type ParsedMealItem = z.infer<typeof ParsedMealItemSchema>;

export const ParsedSetSchema = z.object({
  reps: z.number().min(0),        // int() rejected 8.0 from some models; keep as number
  weight_kg: z.number().nullish(), // null for BW, undefined if omitted
  notes: z.string().nullish(),
});
export type ParsedSet = z.infer<typeof ParsedSetSchema>;

// ─── Per-type entry schemas ───────────────────────────────────────────────────

export const ParsedWeightEntrySchema = z.object({
  type: z.literal("weight"),
  kg: z.number().positive(),
});

export const ParsedMealEntrySchema = z.object({
  type: z.literal("meal"),
  name: z.string(),
  slot: z.enum(["breakfast", "lunch", "dinner", "snack", "pre_workout"]),
  items: z.array(ParsedMealItemSchema),
  total_kcal: z.number().min(0),
  total_protein_g: z.number().min(0),
  location: z.enum(["home", "restaurant", "other"]),
});

export const ParsedWorkoutEntrySchema = z.object({
  type: z.literal("workout"),
  exercise: z.string(),
  sets: z.array(ParsedSetSchema),
  muscle_groups: z.array(z.string()),
});

export const ParsedCardioEntrySchema = z.object({
  type: z.literal("cardio"),
  activity: z.string(),
  duration_min: z.number().min(0),
  intensity: z.enum(["low", "moderate", "high"]).nullish(),
  distance_km: z.number().min(0).nullish(),
  notes: z.string().nullish(),
});

export const ParsedSleepEntrySchema = z.object({
  type: z.literal("sleep"),
  hours: z.number().min(0).max(24),
  quality: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]).nullish(),
});

export const ParsedExpenseEntrySchema = z.object({
  type: z.literal("expense"),
  amount_inr: z.number().positive(),
  item: z.string(),
  category: z.string(),
});

export const ParsedNoteEntrySchema = z.object({
  type: z.literal("note"),
  text: z.string(),
});

// ─── Discriminated union ──────────────────────────────────────────────────────

export const ParsedEntrySchema = z.discriminatedUnion("type", [
  ParsedWeightEntrySchema,
  ParsedMealEntrySchema,
  ParsedWorkoutEntrySchema,
  ParsedCardioEntrySchema,
  ParsedSleepEntrySchema,
  ParsedExpenseEntrySchema,
  ParsedNoteEntrySchema,
]);

export type ParsedEntry = z.infer<typeof ParsedEntrySchema>;
export type ParsedWeightEntry = z.infer<typeof ParsedWeightEntrySchema>;
export type ParsedMealEntry = z.infer<typeof ParsedMealEntrySchema>;
export type ParsedWorkoutEntry = z.infer<typeof ParsedWorkoutEntrySchema>;
export type ParsedCardioEntry = z.infer<typeof ParsedCardioEntrySchema>;
export type ParsedSleepEntry = z.infer<typeof ParsedSleepEntrySchema>;
export type ParsedExpenseEntry = z.infer<typeof ParsedExpenseEntrySchema>;
export type ParsedNoteEntry = z.infer<typeof ParsedNoteEntrySchema>;

// ─── Full API response ────────────────────────────────────────────────────────

export const ParseResponseSchema = z.object({
  entries: z.array(ParsedEntrySchema),
  new_items: z.object({
    foods: z.array(z.string()),
    exercises: z.array(z.string()),
    categories: z.array(z.string()),
  }),
  parse_notes: z.string().nullable(),
});

export type ParseResponse = z.infer<typeof ParseResponseSchema>;
