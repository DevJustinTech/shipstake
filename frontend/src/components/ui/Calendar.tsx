"use client";

import type { ComponentProps } from "react";
import { DayPicker, UI } from "react-day-picker";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type CalendarProps = ComponentProps<typeof DayPicker>;

/** RetroUI-inspired DayPicker with Shipstake's terminal palette. */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("border-2 border-line bg-surface p-3 shadow-brutal-sm", className)}
      classNames={{
        [UI.Months]: "flex flex-col",
        [UI.Month]: "space-y-2",
        [UI.MonthCaption]: "relative flex h-9 items-center justify-center",
        [UI.CaptionLabel]: "font-head text-sm uppercase tracking-wide text-foreground",
        [UI.Nav]: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        [UI.PreviousMonthButton]:
          "grid size-8 cursor-pointer place-items-center border-2 border-line text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        [UI.NextMonthButton]:
          "grid size-8 cursor-pointer place-items-center border-2 border-line text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        [UI.Chevron]: "size-4",
        [UI.MonthGrid]: "w-full border-collapse",
        [UI.Weekdays]: "border-b-2 border-line",
        [UI.Weekday]: "h-8 text-center font-mono text-[10px] uppercase text-muted",
        [UI.Week]: "",
        [UI.Day]: "p-0 text-center",
        [UI.DayButton]:
          "m-px grid size-9 cursor-pointer place-items-center border border-transparent font-mono text-xs text-foreground transition-colors hover:border-primary hover:bg-primary/10 focus-visible:z-10 focus-visible:border-primary focus-visible:outline-none",
        selected: "bg-primary text-background font-bold hover:bg-primary",
        today: "text-primary",
        outside: "text-muted/35",
        disabled: "cursor-not-allowed text-muted/25 hover:border-transparent hover:bg-transparent",
        ...classNames,
      }}
      {...props}
    />
  );
}
