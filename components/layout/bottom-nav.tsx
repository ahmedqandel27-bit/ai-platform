"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

const PRIMARY = ["superComputer", "video", "image", "library"] as const;

/**
 * Phone navigation: the four places people go most, in thumb reach, plus
 * "More" for the rest. Designed for mobile rather than a shrunk sidebar.
 */
export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const openMenu = useUIStore((s) => s.setMobileNavOpen);
  const items = NAV_ITEMS.filter((i) => (PRIMARY as readonly string[]).includes(i.key));

  return (
    <nav
      aria-label={t("topbar.menu")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
                active ? "text-foreground" : "text-muted",
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="bg-gradient-accent absolute top-0 h-0.5 w-8 rounded-full"
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <Icon className={cn("size-5", active && "text-accent")} />
              <span className="max-w-full truncate px-1">{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => openMenu(true)}
          className="flex h-16 flex-col items-center justify-center gap-1 text-[10px] text-muted"
        >
          <Menu className="size-5" />
          <span>{t("topbar.more")}</span>
        </button>
      </div>
    </nav>
  );
}
