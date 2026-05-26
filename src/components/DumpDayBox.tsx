"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParseResponse } from "@/lib/parser/schema";
import ParsePreviewModal from "./ParsePreviewModal";

const PLACEHOLDER = `Woke up 79.4. Breakfast was 3 eggs and 2 chapathi with black coffee.
Gym - squats 60kg 4x8, bench 50kg 3x8 then 1x6, OHP 30kg 3x10, plank 3x45s.
Swim 30 min after gym. Lunch was chicken curry with rice, home-cooked.
Spent 450 on groceries from More. 6 hours sleep last night, was rough.`;

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

type Props = {
  onSaved: () => void;
};

export default function DumpDayBox({ onSaved }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParseResponse | null>(null);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Type something first — describe your day, meals, workout, or weight.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, entry_date: todayIST() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Parse failed. Try again.");
        return;
      }
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
      <Card>
        <CardContent className="pt-4 pb-4 px-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Dump your day</p>
            <span className="text-xs text-muted-foreground">{text.length}/5000</span>
          </div>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-ring resize-none"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 5000));
              if (error) setError("");
            }}
            disabled={loading}
            rows={5}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            className="w-full min-h-[44px]"
            onClick={handleSubmit}
            disabled={loading || text.trim().length === 0}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Parsing your day…
              </span>
            ) : (
              "Parse my day"
            )}
          </Button>
        </CardContent>
      </Card>

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
