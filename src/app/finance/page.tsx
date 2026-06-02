import FinanceDashboard from "@/components/FinanceDashboard";
import Link from "next/link";

export const revalidate = 0;

export default function FinancePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/60 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <h1 className="font-semibold text-lg tracking-tight">Finance</h1>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Today
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        <FinanceDashboard />
      </main>
    </div>
  );
}
