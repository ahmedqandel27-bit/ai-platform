"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Library as LibraryIcon } from "lucide-react";
import { useRunsStore } from "@/generation/stores/runs";
import { cn } from "@/lib/utils";
import { Feed } from "./feed";

type Filter = "all" | "image" | "video";

/** Every generation across both studios, filterable by type. */
export function Library() {
  const t = useTranslations();
  const runs = useRunsStore((s) => s.runs);
  const hydrated = useRunsStore((s) => s.hydrated);
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(() => (filter === "all" ? runs : runs.filter((r) => r.surface === filter)), [runs, filter]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: t("library.all") },
    { id: "image", label: t("library.images") },
    { id: "video", label: t("library.videos") },
  ];

  return (
    <>
      <div role="tablist" className="mb-5 inline-flex rounded-xl border border-border bg-surface-2 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "h-8 rounded-lg px-3.5 text-xs transition-colors",
              filter === tab.id ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Feed
        runs={shown}
        hydrated={hydrated}
        empty={{ icon: LibraryIcon, title: t("studio.feedEmpty"), body: t("library.empty") }}
      />
    </>
  );
}
