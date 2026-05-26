"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Props = {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export default function FormCard({ title, icon, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none flex flex-row items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          {title}
        </span>
        <span className="text-muted-foreground text-sm">{open ? "▲" : "▼"}</span>
      </CardHeader>
      {open && <CardContent className="pt-0 pb-4 px-4">{children}</CardContent>}
    </Card>
  );
}
