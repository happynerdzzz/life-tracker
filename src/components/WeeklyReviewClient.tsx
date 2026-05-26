"use client";

import { useState, useEffect, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateWeeklyReview, type WeeklyReview } from "@/app/review/actions";

// ─── Week helpers (client-side, uses local time) ──────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function toIsoDate(date: Date): string {
  // Use local date parts to avoid UTC shift
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLast8Mondays(): string[] {
  const result: string[] = [];
  const base = getMondayOf(new Date());
  for (let i = 0; i < 8; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    result.push(toIsoDate(d));
  }
  return result;
}

function weekRangeLabel(mondayStr: string): string {
  const mon = new Date(mondayStr + "T00:00:00");
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function weekShortLabel(mondayStr: string, isCurrentWeek: boolean): string {
  const label = weekRangeLabel(mondayStr);
  return isCurrentWeek ? `This week (${label})` : label;
}

function fmtReviewDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  initialReviews: WeeklyReview[];
};

export default function WeeklyReviewClient({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<WeeklyReview[]>(initialReviews);
  const [weekOptions, setWeekOptions] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Compute week options on the client (local time)
  useEffect(() => {
    const options = getLast8Mondays();
    setWeekOptions(options);
    setSelectedWeek(options[0]);
  }, []);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    if (!selectedWeek) return;
    setError(null);
    startTransition(async () => {
      const result = await generateWeeklyReview(selectedWeek);
      if (result.error) {
        setError(result.error);
      } else if (result.review) {
        const newReview = result.review;
        setReviews((prev) => {
          const filtered = prev.filter((r) => r.week_start_date !== newReview.week_start_date);
          return [newReview, ...filtered];
        });
        setExpandedIds((prev) => new Set([...prev, newReview.id]));
      }
    });
  }

  const currentWeekMonday = weekOptions[0] ?? "";

  return (
    <div className="space-y-4">
      {/* Past reviews */}
      {reviews.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground px-1">Past reviews</h2>
          {reviews.map((review) => {
            const isOpen = expandedIds.has(review.id);
            return (
              <Card key={review.id} className="overflow-hidden">
                <button
                  onClick={() => toggleExpand(review.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors"
                  aria-expanded={isOpen}
                >
                  <div>
                    <p className="font-medium text-sm">
                      Week of {weekRangeLabel(review.week_start_date)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generated {fmtReviewDate(review.created_at.split("T")[0])}
                      {review.model_used && (
                        <span className="ml-2 opacity-60">· {review.model_used}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs shrink-0" aria-hidden>
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && review.review_markdown && (
                  <div className="border-t px-4 py-4">
                    <article className="prose prose-sm max-w-none">
                      <ReactMarkdown>{review.review_markdown}</ReactMarkdown>
                    </article>
                  </div>
                )}

                {isOpen && !review.review_markdown && (
                  <div className="border-t px-4 py-4 text-sm text-muted-foreground">
                    No content saved for this review.
                  </div>
                )}
              </Card>
            );
          })}
        </section>
      )}

      {/* Generator card */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Generate a weekly review</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              disabled={isPending || weekOptions.length === 0}
              className="flex-1 min-w-0 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {weekOptions.map((mon, i) => (
                <option key={mon} value={mon}>
                  {weekShortLabel(mon, i === 0 && mon === currentWeekMonday)}
                </option>
              ))}
            </select>

            <Button
              onClick={handleGenerate}
              disabled={isPending || !selectedWeek}
              className="shrink-0"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Generating…
                </span>
              ) : (
                "Generate review"
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          {reviews.length === 0 && !isPending && (
            <p className="text-sm text-muted-foreground">
              No reviews yet. Pick a week above and generate your first one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
