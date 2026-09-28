"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "next-intl";
import { X } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { Logo } from "./logo";
import { NavLinks } from "./sidebar";

/** Slide-in drawer navigation for screens below lg. */
export function MobileNav() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const setOpen = useUIStore((s) => s.setMobileNavOpen);
  const isRtl = useLocale() === "ar";
  const offscreen = isRtl ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            className="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col border-e border-border bg-surface p-3 lg:hidden"
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          >
            <div className="flex h-12 items-center justify-between px-1.5">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
