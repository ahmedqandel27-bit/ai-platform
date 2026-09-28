"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";

/**
 * Imagery with intent: three "generated" frames (video 9:16, image 4:5,
 * video 16:9) drifting very slowly, the way outputs stack up in the studio.
 * Pure CSS light — no stock photos, nothing to load.
 */
const FRAMES = [
  {
    label: "Seedance 2.5 · 9:16",
    video: true,
    className: "start-[6%] top-[8%] h-[62%] aspect-[9/16] -rotate-3",
    bg: "radial-gradient(120% 80% at 20% 10%, rgb(139 92 246 / 0.9), transparent 60%), radial-gradient(90% 70% at 90% 90%, rgb(34 211 238 / 0.7), transparent 60%), #0e0e13",
    drift: 10,
    delay: 0,
  },
  {
    label: "Soul 2 · 4:5",
    video: false,
    className: "end-[4%] top-[4%] w-[46%] aspect-[4/5] rotate-2",
    bg: "radial-gradient(100% 90% at 80% 20%, rgb(236 72 153 / 0.55), transparent 55%), radial-gradient(90% 80% at 10% 100%, rgb(139 92 246 / 0.75), transparent 60%), #0e0e13",
    drift: -8,
    delay: 0.15,
  },
  {
    label: "Kling 3.0 · 16:9",
    video: true,
    className: "bottom-[6%] start-[26%] w-[64%] aspect-video rotate-1",
    bg: "radial-gradient(120% 120% at 0% 0%, rgb(34 211 238 / 0.65), transparent 55%), radial-gradient(80% 90% at 100% 100%, rgb(139 92 246 / 0.8), transparent 60%), #0e0e13",
    drift: 7,
    delay: 0.3,
  },
];

export function StudioVisual() {
  return (
    <div className="relative size-full" aria-hidden>
      {FRAMES.map((frame) => (
        <motion.div
          key={frame.label}
          className={`absolute overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60 ${frame.className}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: [0, frame.drift, 0] }}
          transition={{
            opacity: { duration: 0.8, delay: frame.delay, ease: [0.22, 1, 0.36, 1] },
            y: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: frame.delay },
          }}
          style={{ background: frame.bg }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgb(0_0_0/0.55),transparent_60%)]" />
          {frame.video && (
            <span className="absolute start-3 top-3 grid size-7 place-items-center rounded-full bg-black/40 backdrop-blur">
              <Play className="size-3 fill-white text-white" />
            </span>
          )}
          <span className="absolute bottom-3 start-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] tracking-wide text-white/85 backdrop-blur" dir="ltr">
            {frame.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
