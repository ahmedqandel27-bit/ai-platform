"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Clapperboard, Image as ImageIcon } from "lucide-react";
import type { Surface } from "@/generation/catalog/types";
import { composerFor, rehydrateComposer } from "@/generation/stores/composer";
import { applyPendingHandoff } from "@/generation/stores/handoff";
import { useRunsStore } from "@/generation/stores/runs";
import { Composer } from "./composer";
import { Feed } from "./feed";

/** Image Studio / Video Studio: controls on the start side, generations feed beside them. */
export function Studio({ surface }: { surface: Surface }) {
  const t = useTranslations("studio");
  const allRuns = useRunsStore((s) => s.runs);
  const hydrated = useRunsStore((s) => s.hydrated);
  const runs = useMemo(() => allRuns.filter((r) => r.surface === surface), [allRuns, surface]);

  useEffect(() => {
    rehydrateComposer(surface);
    const apply = () => applyPendingHandoff(surface);
    const store = composerFor(surface);
    if (store.persist.hasHydrated()) apply();
    return store.persist.onFinishHydration(apply);
  }, [surface]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
        <Composer surface={surface} />
      </div>
      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">{t("feedTitle")}</h2>
          <span className="text-xs text-muted">{runs.length}</span>
        </div>
        <Feed
          runs={runs}
          hydrated={hydrated}
          empty={{
            icon: surface === "image" ? ImageIcon : Clapperboard,
            title: t("feedEmpty"),
            body: surface === "image" ? t("feedEmptyImage") : t("feedEmptyVideo"),
          }}
        />
      </section>
    </div>
  );
}
