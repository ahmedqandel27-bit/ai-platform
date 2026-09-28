"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

/** Motion that whispers: short distance, soft ease-out, no bounce. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  delay = 0,
  y = 8,
  children,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Children marked with <StaggerItem> enter one after another. */
export function Stagger({ children, gap = 0.05, ...props }: HTMLMotionProps<"div"> & { gap?: number }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: gap } } }} {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
