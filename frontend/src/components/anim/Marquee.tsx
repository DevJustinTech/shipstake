"use client";

import type { ReactNode } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Marquee({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="flex w-max animate-marquee items-center gap-8">
        <div className="flex shrink-0 items-center gap-8">{children}</div>
        <div className="flex shrink-0 items-center gap-8" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
