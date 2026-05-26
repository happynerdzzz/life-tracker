import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { buildParserPrompt } from "@/lib/parser/prompt";
import { ParseResponseSchema } from "@/lib/parser/schema";

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, entry_date } = body as { text?: unknown; entry_date?: unknown };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required and must be non-empty" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "text too long (max 5000 chars)" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const supabase = createServerClient();
  const [foodsRes, exercisesRes, categoriesRes] = await Promise.all([
    supabase
      .from("foods")
      .select("name, kcal_per_serving, protein_g_per_serving, typical_serving")
      .order("name")
      .limit(100),
    supabase.from("exercises").select("name, muscle_groups").order("name"),
    supabase.from("categories").select("name").order("name"),
  ]);

  const prompt = buildParserPrompt({
    knownFoods: foodsRes.data ?? [],
    knownExercises: exercisesRes.data ?? [],
    knownCategories: (categoriesRes.data ?? []).map((c) => c.name),
    todaysDate: typeof entry_date === "string" ? entry_date : todayIST(),
  });

  const anthropic = new Anthropic({ apiKey });
  let rawResponse: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      temperature: 0.1,
      system: [
        // Static block: cached after first call (~90% cheaper on repeated calls)
        { type: "text", text: prompt.static, cache_control: { type: "ephemeral" } },
        // Dynamic block: today's date + known foods/exercises/categories
        { type: "text", text: prompt.dynamic },
      ],
      messages: [{ role: "user", content: text.trim() }],
    });
    const block = message.content[0];
    if (block.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type from Anthropic" }, { status: 502 });
    }
    rawResponse = block.text;
  } catch (err) {
    return NextResponse.json(
      { error: `Anthropic API error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[parse] raw LLM response:", rawResponse);
  }

  // Strip markdown fences defensively
  const jsonStr = rawResponse
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      {
        error: "LLM returned invalid JSON — try rephrasing your input",
        ...(process.env.NODE_ENV === "development" ? { raw: rawResponse } : {}),
      },
      { status: 422 }
    );
  }

  const result = ParseResponseSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "LLM response failed schema validation",
        validation_errors: result.error.flatten(),
        ...(process.env.NODE_ENV === "development" ? { raw: rawResponse } : {}),
      },
      { status: 422 }
    );
  }

  return NextResponse.json(result.data);
}
