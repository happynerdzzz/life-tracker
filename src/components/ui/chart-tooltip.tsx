import { cn } from "@/lib/utils";

type Row = { name: string; value: string; color?: string };

type Props = {
  active?: boolean;
  label?: string;
  rows: Row[];
  className?: string;
};

export function ChartTooltip({ active, label, rows, className }: Props) {
  if (!active || rows.length === 0) return null;
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/95 backdrop-blur px-3 py-2 shadow-lg text-xs",
        className
      )}
    >
      {label && <p className="font-medium mb-1.5 text-foreground">{label}</p>}
      <div className="space-y-0.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {row.color && (
              <span className="size-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
            )}
            <span className="text-muted-foreground">{row.name}</span>
            <span className="ml-auto font-mono tabular-nums font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
