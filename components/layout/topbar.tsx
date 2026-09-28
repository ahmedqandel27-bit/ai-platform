"use client";

import { useTranslations } from "next-intl";
import { Menu, Search } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { JobsTray } from "./jobs-tray";
import { LocaleToggle } from "./locale-toggle";
import { UserMenu } from "./user-menu";
import { Logo } from "./logo";

export function Topbar({ email }: { email: string | null }) {
  const t = useTranslations("topbar");
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={() => setMobileNavOpen(true)}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 lg:hidden"
        aria-label={t("menu")}
      >
        <Menu className="size-5" />
      </button>
      <Logo compact className="lg:hidden" />

      <button
        onClick={() => setPaletteOpen(true)}
        className="ms-2 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 text-sm text-muted transition-colors hover:border-border-strong sm:max-w-sm lg:ms-0"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">{t("search")}</span>
        <kbd className="ms-auto hidden rounded border border-border px-1.5 text-[10px] sm:inline">
          <bdi dir="ltr">⌘K</bdi>
        </kbd>
      </button>

      <div className="ms-auto flex items-center gap-1">
        <JobsTray />
        <LocaleToggle />
        <div className="ms-1">
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}
