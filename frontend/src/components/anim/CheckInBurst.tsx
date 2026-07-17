"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const PARTICLE_COUNT = 10;
const COLORS = ["var(--color-primary)", "var(--color-glow-cyan)", "var(--color-glow-pink)"];

/** One-shot particle burst — fires when a commitment gets checked in onchain. */
export function CheckInBurst({ active, onDone }: { active: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [active, onDone]);

  return (
    <AnimatePresence>
      {active && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
            const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
            const distance = 60 + (i % 3) * 20;
            return (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 h-2 w-2 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  scale: 1,
                  opacity: 0,
                }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
