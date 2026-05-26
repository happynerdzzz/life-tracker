"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { ParseResponse } from "@/lib/parser/schema";
import ParsePreviewModal from "./ParsePreviewModal";

const EXAMPLES = [
  "Woke up 79.4 kg. 3 eggs and 2 chapathi for breakfast. Bench press 4×8 at 60kg, squats 3×10 at 80kg.",
  "Dal rice and sabzi for lunch at home, around 550 kcal. 30 min swim after. Spent ₹340 on groceries.",
  "OHP 3×10 at 30kg, pullups 3×8 BW. Chicken curry dinner. 7.5 hrs sleep, felt good.",
  "Rest day. Had idli with sambar for breakfast, rice for lunch. Protein shake 25g. Spent ₹120 eating out.",
  "Squats 5×5 at 100kg PR! Slept only 5.5h last night. Spent ₹450 on supplements.",
];

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

type Props = { onSaved: () => void };

export default function DumpDayBox({ onSaved }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % EXAMPLES.length), 4000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) { setError("Type something first — describe your day, meals, workout, or weight."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, entry_date: todayIST() }),
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

  function handleSaved() {
    setResult(null);
    setText("");
    onSaved();
  }

  return (
    <>
      <div className="space-y-3">
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
            onClick={handleSubmit}
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
      </div>

      {result && (
        <ParsePreviewModal
          result={result}
          entryDate={todayIST()}
          rawText={text.trim()}
          onSaved={handleSaved}
          onCancel={() => setResult(null)}
        />
      )}
    </>
  );
}
