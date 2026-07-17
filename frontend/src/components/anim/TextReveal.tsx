"use client";

import { motion } from "motion/react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Staggered word reveal — each word slides up out of a clipped mask. */
export function TextReveal({
  text,
  className,
  delay = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "p" | "span";
}) {
  const words = text.split(" ");
  return (
    <Tag className={cn("inline-block", className)}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
          <motion.span
            className="inline-block will-change-transform"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            transition={{ delay: delay + i * 0.06, duration: 0.5, ease: [0.22, 1.2, 0.36, 1] }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
