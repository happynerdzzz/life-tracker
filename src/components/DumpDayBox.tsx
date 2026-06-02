"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ParseResponseSchema } from "@/lib/parser/schema";
import type { ParseResponse } from "@/lib/parser/schema";
import ParsePreviewModal from "./ParsePreviewModal";

const EXAMPLES = [
  "Woke up 79.4 kg. 3 eggs and 2 chapathi for breakfast. Bench press 4×8 at 60kg, squats 3×10 at 80kg.",
  "Dal rice and sabzi for lunch at home, around 550 kcal. 30 min swim after. Spent ₹340 on groceries.",
  "OHP 3×10 at 30kg, pullups 3×8 BW. Chicken curry dinner. 7.5 hrs sleep, felt good.",
  "Rest day. Had idli with sambar for breakfast, rice for lunch. Protein shake 25g. Spent ₹120 eating out.",
  "Squats 5×5 at 100kg PR! Slept only 5.5h last night. Spent ₹450 on supplements.",
];

const JSON_HINT = `Ask Claude (claude.ai) with this prompt — paste your day at the bottom:

"Parse the text below into JSON only, no prose, no markdown fences.
Format:
{ "entries": [...], "new_items": { "foods": [], "exercises": [], "categories": [] }, "parse_notes": null }

Entry types:
  weight       → { type, kg }
  meal         → { type, name, slot, items[{food,qty,kcal,protein_g}], total_kcal, total_protein_g, location }
  workout      → { type, exercise, sets[{reps,weight_kg}], muscle_groups[] }
  cardio       → { type, activity, duration_min, intensity }
  sleep        → { type, hours, quality (1–5) }
  expense      → { type, amount_inr, item, category }
  note         → { type, text }

slot: breakfast/lunch/dinner/snack/pre_workout
location: home/restaurant/other
intensity: low/moderate/high

[paste your day here]"`;

type Props = { onSaved: () => void; entryDate: string };

export default function DumpDayBox({ onSaved, entryDate }: Props) {
  const [mode, setMode] = useState<"ai" | "json">("ai");
  const [text, setText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % EXAMPLES.length), 4000);
    return () => clearInterval(id);
  }, []);

  async function handleAiSubmit() {
    const trimmed = text.trim();
    if (!trimmed) { setError("Type something first — describe your day, meals, workout, or weight."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, entry_date: entryDate }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Parse failed. Try again."); return; }
      setResult(data as ParseResponse);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleJsonPreview() {
    setError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch {
      setError("Invalid JSON — check formatting and try again.");
      return;
    }
    const validation = ParseResponseSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.slice(0, 3).map((i) => i.message).join("; ");
      setError(`Schema error: ${issues}`);
      return;
    }
    setResult(validation.data);
  }

  function handleSaved() {
    setResult(null);
    setText("");
    setJsonText("");
    onSaved();
  }

  return (
    <>
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit mb-3">
        {(["ai", "json"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              mode === m
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "ai" ? "✨ AI Parse" : "{ } Paste JSON"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {mode === "ai" ? (
          <>
            <textarea
              className="w-full min-h-32 resize-none rounded-2xl bg-muted/50 border-0 px-4 py-3 text-sm
                         placeholder:text-muted-foreground/60 outline-none transition-all
                         focus:bg-card focus:ring-2 focus:ring-primary/30"
              placeholder={EXAMPLES[placeholderIdx]}
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, 5000)); if (error) setError(""); }}
              disabled={loading}
              rows={4}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">{text.length}/5000</span>
              <Button
                onClick={handleAiSubmit}
                disabled={loading || text.trim().length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 h-9 text-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Parsing…
                  </span>
                ) : (
                  "Parse with Claude ✨"
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                How to get this JSON (no API cost)
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded-xl whitespace-pre-wrap font-mono text-[11px] leading-relaxed select-all">
                {JSON_HINT}
              </pre>
            </details>

            <textarea
              className="w-full min-h-40 resize-none rounded-2xl bg-muted/50 border-0 px-4 py-3 text-xs
                         font-mono placeholder:text-muted-foreground/50 outline-none transition-all
                         focus:bg-card focus:ring-2 focus:ring-primary/30"
              placeholder={'{ "entries": [...], "new_items": { "foods": [], "exercises": [], "categories": [] }, "parse_notes": null }'}
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); if (error) setError(""); }}
              rows={6}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button
                onClick={handleJsonPreview}
                disabled={jsonText.trim().length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 h-9 text-sm"
              >
                Preview entries
              </Button>
            </div>
          </>
        )}
      </div>

      {result && (
        <ParsePreviewModal
          result={result}
          entryDate={entryDate}
          rawText={mode === "ai" ? text.trim() : ""}
          onSaved={handleSaved}
          onCancel={() => setResult(null)}
        />
      )}
    </>
  );
}
