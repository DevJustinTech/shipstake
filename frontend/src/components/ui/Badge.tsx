import type { HTMLAttributes } from "react";

const colors = {
  lime: "border-primary text-primary bg-primary/10",
  amber: "border-glow-amber text-glow-amber bg-glow-amber/10",
  pink: "border-glow-pink text-glow-pink bg-glow-pink/10",
  cyan: "border-glow-cyan text-glow-cyan bg-glow-cyan/10",
  red: "border-glow-red text-glow-red bg-glow-red/10",
  muted: "border-line text-muted bg-white/5",
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: keyof typeof colors;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Badge({ color = "lime", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wide",
        colors[color],
        className,
      )}
      {...props}
    />
  );
}
