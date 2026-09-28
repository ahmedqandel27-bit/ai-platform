"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { listProjectRuns } from "@/generation/actions";
import { getProject } from "@/lib/projects/actions";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { Feed } from "@/components/studio/feed";
import { RequiresSupabase } from "@/components/common/requires-supabase";

type Filter = "all" | "image" | "video";

/** One project: every teammate's generations filed under it. */
export function ProjectDetail({ id }: { id: string }) {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const result = await getProject({ id });
      return result.ok ? result.data : null;
    },
    enabled: isSupabaseConfigured,
  });
  const { data: runs, isLoading } = useQuery({
    queryKey: ["project-runs", id],
    queryFn: async () => {
      const result = await listProjectRuns({ projectId: id });
      return result.ok ? result.data : [];
    },
    enabled: isSupabaseConfigured,
    refetchInterval: 15_000,
  });
  const shown = useMemo(() => (runs ?? []).filter((r) => filter === "all" || r.surface === filter), [runs, filter]);

  if (!isSupabaseConfigured) return <RequiresSupabase />;

  return (
    <div>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
        <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
        {t("projects.back")}
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-border-strong bg-surface-2">
          <FolderKanban className="size-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-semibold" dir="auto">
            {loadingProject ? "…" : (project?.name ?? t("projects.notFound"))}
          </h1>
          <p className="text-sm text-muted">{t("projects.detailHint")}</p>
        </div>
      </div>
      <div role="tablist" className="mb-5 inline-flex rounded-xl border border-border bg-surface-2 p-1">
        {(["all", "image", "video"] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "h-8 rounded-lg px-3.5 text-xs transition-colors",
              filter === id ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {t(`library.${id === "all" ? "all" : id === "image" ? "images" : "videos"}`)}
          </button>
        ))}
      </div>
      <Feed
        runs={shown}
        hydrated={!isLoading}
        readOnly
        empty={{ icon: FolderKanban, title: t("studio.feedEmpty"), body: t("projects.detailEmpty") }}
      />
    </div>
  );
}
