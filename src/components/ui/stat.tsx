import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export function Stat({ label, value, sublabel, trend, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-3xl font-semibold tracking-tight leading-none">
        {value}
      </span>
      {(sublabel || trend) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          {trend === "up" && <span className="text-green-500">▲</span>}
          {trend === "down" && <span className="text-red-500">▼</span>}
          {trend === "neutral" && <span>·</span>}
          {sublabel && <span>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
