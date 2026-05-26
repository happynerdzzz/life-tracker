"use client";

import { useState, useMemo, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { generateWeeklyReview, type WeeklyReview } from "@/app/review/actions";

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function toIsoDate(date: Date): string {
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
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function weekShortLabel(mondayStr: string, isCurrentWeek: boolean): string {
  const label = weekRangeLabel(mondayStr);
  return isCurrentWeek ? `This week (${label})` : label;
}

// ─── Parse markdown sections from the review ──────────────────────────────────

function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  let capturing = false;
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("# ")) {
      if (capturing) break;
      if (line.toLowerCase().includes(heading.toLowerCase())) { capturing = true; continue; }
    } else if (capturing) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

function extractGrade(markdown: string): { letter: string; rationale: string } {
  const section = extractSection(markdown, "grade");
  const match = section.match(/^([A-F][+-]?)\s*[—–-]\s*(.+)/m);
  if (match) return { letter: match[1], rationale: match[2] };
  // fallback: look for any letter grade at start of content
  const letterMatch = markdown.match(/\b([A-F][+-]?)\b\s*[—–-]\s*(.+)/m);
  if (letterMatch) return { letter: letterMatch[1], rationale: letterMatch[2] };
  return { letter: "—", rationale: "" };
}

// ─── Grade color ──────────────────────────────────────────────────────────────

function gradeColor(letter: string): string {
  if (letter.startsWith("A")) return "text-green-500";
  if (letter.startsWith("B")) return "text-[var(--chart-1)]";
  if (letter.startsWith("C")) return "text-[var(--chart-5)]";
  if (letter.startsWith("D")) return "text-orange-500";
  return "text-destructive";
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-muted ${className}`} />
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 to-transparent p-5 flex gap-4">
        <Shimmer className="size-20 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-3 w-48" />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {["Wins", "Slips", "Actions"].map((s) => (
          <div key={s} className="rounded-2xl border border-border/60 overflow-hidden">
            <Shimmer className="h-1 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <Shimmer className="h-3.5 w-20" />
              <Shimmer className="h-3 w-full" />
              <Shimmer className="h-3 w-4/5" />
              <Shimmer className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pillar card ──────────────────────────────────────────────────────────────

const PILLAR_STYLES = {
  wins:    { stripe: "bg-green-500", title: "What Went Well" },
  slips:   { stripe: "bg-[var(--chart-5)]", title: "What Slipped" },
  actions: { stripe: "bg-[var(--chart-1)]", title: "3 Actions" },
} as const;

function PillarCard({ kind, content }: { kind: keyof typeof PILLAR_STYLES; content: string }) {
  const s = PILLAR_STYLES[kind];
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.04)]">
      <div className={`h-1 ${s.stripe}`} />
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{s.title}</p>
        {content ? (
          <article className="prose prose-sm prose-neutral max-w-none text-sm">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-muted-foreground italic">No data</p>
        )}
      </div>
    </div>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: WeeklyReview }) {
  const { letter, rationale } = extractGrade(review.review_markdown ?? "");
  const winsContent = extractSection(review.review_markdown ?? "", "went well");
  const slipsContent = extractSection(review.review_markdown ?? "", "slipped");
  const actionsContent = extractSection(review.review_markdown ?? "", "actions");
  const watchOut = extractSection(review.review_markdown ?? "", "watch");

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 to-transparent p-5 flex items-start gap-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.04)]">
        <span className={`text-7xl font-bold tracking-tighter leading-none shrink-0 ${gradeColor(letter)}`}>
          {letter}
        </span>
        <div className="flex flex-col gap-1 pt-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {weekRangeLabel(review.week_start_date)}
          </p>
          {rationale && <p className="text-sm font-medium leading-snug">{rationale}</p>}
          {review.model_used && (
            <p className="text-[11px] text-muted-foreground/60 mt-1">{review.model_used}</p>
          )}
        </div>
      </div>

      {/* Three pillars */}
      <div className="grid md:grid-cols-3 gap-4">
        <PillarCard kind="wins" content={winsContent} />
        <PillarCard kind="slips" content={slipsContent} />
        <PillarCard kind="actions" content={actionsContent} />
      </div>

      {/* Watch out strip */}
      {watchOut && (
        <div className="rounded-xl border border-border/60 bg-[var(--chart-5)]/8 px-4 py-3 text-sm">
          <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Watch Out · </span>
          <span>{watchOut}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = { initialReviews: WeeklyReview[] };

export default function WeeklyReviewClient({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<WeeklyReview[]>(initialReviews);
  // Computed once during render; client timezone governs week boundaries
  const weekOptions = useMemo(() => getLast8Mondays(), []);
  const [selectedWeek, setSelectedWeek] = useState<string>(() => weekOptions[0] ?? "");
  const [activeReview, setActiveReview] = useState<WeeklyReview | null>(initialReviews[0] ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        setActiveReview(newReview);
      }
    });
  }

  const currentWeekMonday = weekOptions[0] ?? "";

  return (
    <div className="space-y-6">
      {/* Generator card */}
      <Card>
        <CardContent className="px-5 py-4 space-y-3">
          <SectionHeader title="Generate review" />
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              disabled={isPending || weekOptions.length === 0}
              className="flex-1 min-w-0 h-9 rounded-xl border border-input bg-muted/40 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="shrink-0 h-9"
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
            <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Active/loading review */}
      {isPending && <ReviewSkeleton />}

      {!isPending && activeReview && <ReviewCard review={activeReview} />}

      {/* Past reviews list */}
      {reviews.length > 1 && (
        <div className="space-y-2">
          <SectionHeader title="Past reviews" />
          {reviews.filter((r) => r.id !== activeReview?.id).map((review) => {
            const { letter } = extractGrade(review.review_markdown ?? "");
            return (
              <button
                key={review.id}
                onClick={() => setActiveReview(review)}
                className="w-full text-left rounded-2xl border border-border/60 bg-card px-4 py-3 flex items-center gap-3 hover:bg-accent/40 transition-colors shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
              >
                <span className={`text-2xl font-bold tabular-nums leading-none ${gradeColor(letter)}`}>{letter}</span>
                <div>
                  <p className="text-sm font-medium">{weekRangeLabel(review.week_start_date)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Generated {new Date(review.created_at + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="ml-auto text-muted-foreground text-xs">View →</span>
              </button>
            );
          })}
        </div>
      )}

      {reviews.length === 0 && !isPending && (
        <div className="flex flex-col items-center py-12 gap-2 text-center text-muted-foreground">
          <span className="text-4xl">📊</span>
          <p className="text-sm">No reviews yet. Pick a week and generate your first one.</p>
        </div>
      )}
    </div>
  );
}
