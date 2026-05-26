"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import type { Insight } from "@/app/api/insights/route";

const SEVERITY_COLOR: Record<string, string> = {
  positive: "var(--chart-2)",
  warning:  "var(--chart-3)",
  neutral:  "var(--muted-foreground)",
};

export default function InsightsCard() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setInsights(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || insights.length === 0) return null;

  return (
    <Card>
      <CardContent className="px-4 pb-4 pt-3">
        <SectionHeader
          title="Insights"
          action={<Link href="/history" className="text-muted-foreground hover:text-foreground transition-colors">View all →</Link>}
          className="mb-3"
        />
        <div className="space-y-3">
          {insights.map((insight) => (
            <div key={insight.id} className="flex gap-3">
              <span
                className="mt-1 size-2 rounded-full shrink-0"
                style={{ backgroundColor: SEVERITY_COLOR[insight.severity] ?? SEVERITY_COLOR.neutral }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
