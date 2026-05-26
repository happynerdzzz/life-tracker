import Link from "next/link";
import { fetchPastReviews } from "./actions";
import WeeklyReviewClient from "@/components/WeeklyReviewClient";

export const revalidate = 0;

export default async function ReviewPage() {
  const pastReviews = await fetchPastReviews();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Today
          </Link>
          <h1 className="font-bold text-lg tracking-tight">Weekly Review</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        <WeeklyReviewClient initialReviews={pastReviews} />
      </main>
    </div>
  );
}
