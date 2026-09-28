"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { Languages, Search } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { useUIStore } from "@/lib/stores/ui-store";
import { useToggleLocale } from "./locale-toggle";

const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground data-[selected=true]:bg-white/[0.06] [&_svg]:size-4 [&_svg]:text-muted";

/**
 * ⌘K / Ctrl+K command palette + global shortcuts (⌘1..⌘3 jump to workspaces).
 * Later phases register actions here (new generation, open project, …).
 */
export function CommandPalette() {
  const t = useTranslations();
  const router = useRouter();
  const open = useUIStore((s) => s.paletteOpen);
  const setOpen = useUIStore((s) => s.setPaletteOpen);
  const { toggle: toggleLocale } = useToggleLocale();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUIStore.getState().paletteOpen);
        return;
      }
      const item = NAV_ITEMS.find((i) => i.shortcut === e.key);
      if (item) {
        e.preventDefault();
        router.push(item.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[15vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              label="Command palette"
              className="overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl shadow-black/70"
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            >
              <div className="flex items-center gap-2 border-b border-border px-4">
                <Search className="size-4 text-muted" />
                <Command.Input
                  autoFocus
                  placeholder={t("palette.placeholder")}
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                />
              </div>
              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-muted">{t("palette.empty")}</Command.Empty>
                <Command.Group
                  heading={t("palette.navigate")}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted"
                >
                  {NAV_ITEMS.map((item) => (
                    <Command.Item
                      key={item.key}
                      value={`${item.key} ${t(`nav.${item.key}`)}`}
                      onSelect={() => run(() => router.push(item.href))}
                      className={itemClass}
                    >
                      <item.icon />
                      {t(`nav.${item.key}`)}
                      {item.shortcut && (
                        <kbd className="ms-auto text-[10px] text-muted" dir="ltr">
                          ⌘{item.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group
                  heading={t("palette.actions")}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted"
                >
                  <Command.Item value="language arabic english لغة" onSelect={() => run(toggleLocale)} className={itemClass}>
                    <Languages />
                    {t("palette.switchLanguage")}
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
