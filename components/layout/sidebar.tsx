"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "./logo";

/** Nav links, shared by the desktop sidebar and the mobile drawer. */
export function NavLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // Radix positions are physical, so flip the tooltip side for RTL.
  const tooltipSide = useLocale() === "ar" ? "left" : "right";

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    const link = (
      <Link
        key={item.key}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
          active ? "text-foreground" : "text-muted hover:bg-white/[0.03] hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {active && (
          <motion.span
            layoutId={onNavigate ? "nav-active-mobile" : "nav-active"}
            className="absolute inset-0 rounded-xl border border-border-strong bg-white/[0.05]"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        )}
        <Icon className={cn("relative size-[18px] shrink-0", active && "text-accent")} />
        {!collapsed && <span className="relative truncate">{t(item.key)}</span>}
        {!collapsed && item.shortcut && (
          <kbd className="relative ms-auto hidden text-[10px] text-muted/60 lg:inline" dir="ltr">
            ⌘{item.shortcut}
          </kbd>
        )}
      </Link>
    );

    if (!collapsed) return link;
    return (
      <Tooltip key={item.key}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side={tooltipSide}>{t(item.key)}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <nav className="flex flex-col gap-6">
      {(["create", "manage"] as const).map((group) => (
        <div key={group} className="flex flex-col gap-1">
          {!collapsed && (
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/60">{t(group)}</p>
          )}
          {NAV_ITEMS.filter((i) => i.group === group).map(renderItem)}
        </div>
      ))}
    </nav>
  );
}

/** Desktop sidebar (hidden below lg). Collapsible, state persisted. */
export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-border bg-surface/60 p-3 backdrop-blur-xl transition-[width] duration-300 lg:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className={cn("flex h-12 items-center px-1.5", collapsed && "justify-center px-0")}>
        <Logo compact={collapsed} />
      </div>
      <div className="mt-6 flex-1 overflow-y-auto">
        <NavLinks collapsed={collapsed} />
      </div>
      <button
        onClick={toggle}
        className="flex h-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        aria-label="Toggle sidebar"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4 rtl:-scale-x-100" />
        ) : (
          <PanelLeftClose className="size-4 rtl:-scale-x-100" />
        )}
      </button>
    </aside>
  );
}
