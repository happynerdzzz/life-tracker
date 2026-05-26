"use client";

import { Drawer } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Drawer.Root>
  );
}

type SheetContentProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

export function SheetContent({ children, className, title }: SheetContentProps) {
  return (
    <Drawer.Portal>
      <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <Drawer.Popup
        className={cn(
          // Mobile: slide up from bottom
          "fixed bottom-0 left-0 right-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl bg-card focus:outline-none",
          // Desktop: centered modal
          "sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl",
          "shadow-[0_8px_40px_rgb(0_0_0/0.18)]",
          "transition-transform duration-300 ease-out",
          "data-[ending-style]:translate-y-full sm:data-[ending-style]:translate-y-[-40%] sm:data-[ending-style]:opacity-0",
          "data-[starting-style]:translate-y-full sm:data-[starting-style]:translate-y-[-40%] sm:data-[starting-style]:opacity-0",
          className
        )}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        {title && (
          <Drawer.Title className="px-5 pb-1 pt-2 text-base font-semibold tracking-tight sm:pt-4">
            {title}
          </Drawer.Title>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Drawer.Popup>
    </Drawer.Portal>
  );
}

export function SheetClose({ children }: { children: React.ReactNode }) {
  return <Drawer.Close render={<>{children}</>} />;
}
