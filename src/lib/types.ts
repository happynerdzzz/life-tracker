export type WeightData = {
  kg: number;
};

export type MealData = {
  name: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout";
  items: Array<{
    food: string;
    qty: string;
    kcal: number;
    protein_g: number;
  }>;
  total_kcal: number;
  total_protein_g: number;
  location: "home" | "restaurant" | "other";
};

export type WorkoutData = {
  exercise: string;
  sets: Array<{
    reps: number;
    weight_kg: number | null;
    notes?: string;
  }>;
  muscle_groups: string[];
  duration_min?: number;
  calories_burned?: number;
};

export type CardioData = {
  activity: string;
  duration_min: number;
  intensity?: "low" | "moderate" | "high";
  distance_km?: number;
  calories_burned?: number;
  notes?: string;
};

export type SleepData = {
  hours: number;
  quality?: 1 | 2 | 3 | 4 | 5;
};

export type SplitParticipant = { name: string; share: number; settled: boolean };
export type SplitInfo = {
  total_amount: number;
  paid_by: "me" | string;
  participants: SplitParticipant[];
};

export type ExpenseData = {
  amount_inr: number;
  item: string;
  category: string;
  split?: SplitInfo;
};

export type NoteData = {
  text: string;
};

export type IncomeData = {
  amount_inr: number;
  source: string;
  category: string;
};

export type EntryData =
  | ({ type: "weight" } & WeightData)
  | ({ type: "meal" } & MealData)
  | ({ type: "workout" } & WorkoutData)
  | ({ type: "cardio" } & CardioData)
  | ({ type: "sleep" } & SleepData)
  | ({ type: "expense" } & ExpenseData)
  | ({ type: "income" } & IncomeData)
  | ({ type: "note" } & NoteData);

export type Entry = {
  id: string;
  created_at: string;
  updated_at: string;
  entry_date: string;
  entry_time: string | null;
  type: string;
  raw_text: string | null;
  source: "form" | "parser" | "manual_edit";
  data: Record<string, unknown>;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_groups: string[] | null;
  default_unit: string | null;
};

export type Category = {
  id: string;
  name: string;
  kind: string;
};

export type Target = {
  id: string;
  day_type: "gym" | "rest" | "weekend";
  kcal_target: number | null;
  protein_target_g: number | null;
  notes: string | null;
};
