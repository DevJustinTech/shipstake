import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "default" | "lg";

const base =
  "font-head inline-flex cursor-pointer items-center justify-center gap-2 border-2 whitespace-nowrap select-none transition-all duration-150 disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary:
    "border-primary bg-primary text-background shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:translate-x-1 active:translate-y-1 active:shadow-none",
  outline:
    "border-primary bg-transparent text-primary shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:translate-x-1 active:translate-y-1 active:shadow-none",
  ghost: "border-transparent text-muted hover:text-foreground hover:border-line",
  danger:
    "border-glow-red bg-glow-red/10 text-glow-red shadow-[4px_4px_0_0_var(--color-glow-red)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:translate-x-1 active:translate-y-1 active:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  default: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({ variant = "primary", size = "default", className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
