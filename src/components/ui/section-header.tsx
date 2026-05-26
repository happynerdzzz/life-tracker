import { cn } from "@/lib/utils";

type Props = {
  title: string;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ title, action, className }: Props) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </span>
      {action && <div className="text-xs">{action}</div>}
    </div>
  );
}
