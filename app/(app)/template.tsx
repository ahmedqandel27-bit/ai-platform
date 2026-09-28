"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/reveal";

/** Re-mounts on every navigation: a quiet fade + rise between pages. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      {children}
    </motion.div>
  );
}
