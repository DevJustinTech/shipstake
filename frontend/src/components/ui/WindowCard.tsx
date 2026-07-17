import type { ReactNode } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** A bordered "terminal window" panel — RetroUI-style chrome, dark/crypto palette. */
export function WindowCard({
  title,
  className,
  children,
  accent = "primary",
}: {
  title: string;
  className?: string;
  children: ReactNode;
  accent?: "primary" | "pink" | "cyan" | "amber";
}) {
  const accentColor = {
    primary: "bg-primary",
    pink: "bg-glow-pink",
    cyan: "bg-glow-cyan",
    amber: "bg-glow-amber",
  }[accent];

  return (
    <div className={cn("border-2 border-line bg-surface shadow-brutal", className)}>
      <div className="flex items-center justify-between border-b-2 border-line px-4 py-2">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted">{title}</span>
        <div className="flex gap-1.5" aria-hidden="true">
          <span className={cn("h-2.5 w-2.5 rounded-full", accentColor)} />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </div>
      </div>
      {children}
    </div>
  );
}
