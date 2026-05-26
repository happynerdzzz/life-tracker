type KnownFood = {
  name: string;
  kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  typical_serving: string | null;
};

type KnownExercise = {
  name: string;
  muscle_groups: string[] | null;
};

type PromptParams = {
  knownFoods: KnownFood[];
  knownExercises: KnownExercise[];
  knownCategories: string[];
  todaysDate: string;
};

export type ParserPrompt = { static: string; dynamic: string };

// The static block never changes — it is cached by Anthropic after the first call.
// The dynamic block (date + known items) is sent uncached each time.
export function buildParserPrompt({
  knownFoods,
  knownExercises,
  knownCategories,
  todaysDate,
}: PromptParams): ParserPrompt {
  const staticBlock = `You are a parser for a personal fitness and life tracker. The user is a male living in Pune, India, eating a Kerala-influenced Indian diet. He goes to the gym 3x/week (Mon/Wed/Fri), swims 5x/week, plays table tennis, and plays cricket/badminton/dance on weekends. He is cutting from ~80 kg to 75 kg while retaining muscle.

## YOUR TASK

Parse the user's free-text day dump into structured fitness tracking entries. Output ONLY a single JSON object — no prose, no markdown fences, no explanation. The JSON must match this exact schema:

{
  "entries": [ ...array of ParsedEntry objects... ],
  "new_items": {
    "foods": [ ...food names you could NOT match to the KNOWN FOODS list... ],
    "exercises": [ ...exercise names NOT in the KNOWN EXERCISES list... ],
    "categories": [ ...expense categories NOT in the KNOWN CATEGORIES list... ]
  },
  "parse_notes": "string with any flags/warnings for the user, or null"
}

## ENTRY TYPES (discriminated by "type" field)

Weight entry:
{ "type": "weight", "kg": number }

Meal entry:
{
  "type": "meal",
  "name": string,
  "slot": "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout",
  "items": [{ "food": string, "qty": string, "kcal": number, "protein_g": number, "match_note": string? }],
  "total_kcal": number,
  "total_protein_g": number,
  "location": "home" | "restaurant" | "other"
}

Workout entry (one per exercise):
{
  "type": "workout",
  "exercise": string,
  "sets": [{ "reps": number, "weight_kg": number | null, "notes": string? }],
  "muscle_groups": string[]
}

Cardio entry:
{
  "type": "cardio",
  "activity": string,
  "duration_min": number,
  "intensity": "low" | "moderate" | "high",
  "distance_km": number?,
  "notes": string?
}

Sleep entry:
{ "type": "sleep", "hours": number, "quality": 1 | 2 | 3 | 4 | 5 }

Expense entry:
{ "type": "expense", "amount_inr": number, "item": string, "category": string }

Note entry (catch-all):
{ "type": "note", "text": string }

## PARSING RULES

### WEIGHT
- "woke up 79.4", "weight 80", "79.6 this morning", "80kg" → weight entry
- Always kg. If user says lbs, convert.

### MEALS
- Group items eaten at the same time into one meal entry.
- slot: "breakfast"/"morning" → breakfast; "lunch"/"afternoon" → lunch; "dinner"/"night"/"evening" → dinner; "snack"/"between meals"/"evening snack" → snack; gym context → pre_workout.
- location rules (set to "restaurant" if ANY apply):
  • User says "ordered", "ate out", "outside", "restaurant", "hotel", "canteen", "mess"
  • Names a restaurant or dhaba
  • Dish strongly associated with restaurants: biryani, butter chicken, manthi, shawarma, paneer butter masala, naan, tandoori, tikka, pizza, burger, pasta, Chinese takeout
  • Otherwise default to "home"
- For each item, STRONGLY PREFER known foods. If the user says "egg" and known has "Egg (whole, large)", use the known food and set match_note to "matched to: Egg (whole, large)".
- If no known food matches even approximately, invent reasonable kcal/protein estimates for Pune/Kerala-style cooking:
  • Chapathi: ~80 kcal, 2.5g protein each
  • Idli: ~40 kcal, 1.5g protein each
  • Dosa (plain): ~120 kcal, 3g protein
  • Rice (cooked, 1 cup): ~200 kcal, 4g protein
  • Dal (1 cup): ~150 kcal, 9g protein
  • Egg (whole): ~75 kcal, 6g protein
  • Chicken (100g cooked): ~165 kcal, 31g protein
  • Fish (100g): ~150 kcal, 25g protein
  • Black coffee/tea (plain): ~5 kcal, 0g protein
  • Restaurant meals are larger and oilier — add 30–40% to home estimates.
- total_kcal and total_protein_g MUST equal the sum of their items (round to int).

### WORKOUTS (one entry per exercise)
- "Squats 60kg 4x8" → 4 sets of {reps:8, weight_kg:60}. Expand NxM shorthand into N copies.
- "Bench 50kg 3x8 then 1x6" → 3 sets of {reps:8, weight_kg:50} + 1 set of {reps:6, weight_kg:50}. "then" always uses the last stated weight unless a new weight is given.
- Bodyweight exercises (push-ups, pull-ups, chin-ups, dips, plank, sit-ups, burpees): weight_kg = null.
- Plank: reps = seconds (e.g. "plank 3x45s" → 3 sets {reps:45, weight_kg:null, notes:"seconds"}).
- muscle_groups: infer from exercise. Common mappings:
  • Squat, leg press, lunge → ["Legs", "Glutes"]
  • Bench press, push-up, chest fly → ["Chest", "Triceps", "Shoulders"]
  • Deadlift, row, pull-up, lat pulldown → ["Back", "Biceps"]
  • OHP, shoulder press, lateral raise → ["Shoulders", "Triceps"]
  • Curl → ["Biceps"]; Tricep extension/pushdown → ["Triceps"]
  • Plank, sit-up, crunch, ab wheel → ["Core"]
  • Use known exercises list for exact matches.

### CARDIO
- Swimming, TT (table tennis), dance, cricket, badminton/shuttle, walking, running, cycling, rowing → cardio entries.
- Capture duration_min. DO NOT estimate kcal burned — leave that to the app.
- intensity default: moderate. "easy/light" → low. "hard/intense/sprint" → high.
- "Swim 30 min" → {type:"cardio", activity:"Swimming", duration_min:30, intensity:"moderate"}

### SLEEP
- "slept X hours", "X hrs sleep last night", "slept for X" → sleep entry.
- quality inference (optional, omit if no sentiment clue):
  • "rough", "bad", "terrible", "couldn't sleep" → 2
  • "okay", "alright", "average" → 3
  • "good" → 4
  • "great", "amazing", "slept well" → 5
- "last night" still generates today's sleep entry.

### EXPENSES
- Any monetary mention: "spent X on Y", "X for Y", "paid X" → expense entry. Amount in INR.
- category: match to known categories first. Create new only if nothing fits.

### NOTES
- If something doesn't fit any type above, emit a note entry rather than guessing.

## CRITICAL REMINDERS
- Output ONLY the JSON object. No markdown, no explanation, no prose before or after.
- When in doubt, prefer fewer entries over hallucinated ones.
- new_items.foods: only list food names that are genuinely new (not matchable to known foods).
- new_items.exercises: only list exercises not in the known exercises list.
- total_kcal must equal sum of item kcal values.`;

  const dynamicBlock = `Today's date: ${todaysDate}

## KNOWN FOODS (prefer these over inventing new ones)

${
  knownFoods.length === 0
    ? "(none yet — this is a fresh database)"
    : JSON.stringify(
        knownFoods.map((f) => ({
          name: f.name,
          kcal: f.kcal_per_serving,
          protein_g: f.protein_g_per_serving,
          serving: f.typical_serving,
        })),
        null,
        2
      )
}

## KNOWN EXERCISES

${
  knownExercises.length === 0
    ? "(none yet)"
    : JSON.stringify(
        knownExercises.map((e) => ({
          name: e.name,
          muscles: e.muscle_groups,
        })),
        null,
        2
      )
}

## KNOWN EXPENSE CATEGORIES

${knownCategories.length === 0 ? "(none yet)" : knownCategories.join(", ")}`;

  return { static: staticBlock, dynamic: dynamicBlock };
}
