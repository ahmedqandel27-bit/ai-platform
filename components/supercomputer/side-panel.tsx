"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { BookMarked, Loader2, MessageSquarePlus, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isTerminal } from "@/generation/run-types";
import { useRunsStore } from "@/generation/stores/runs";
import { deleteRecipe, listRecipes, type Recipe } from "@/lib/supercomputer/actions";
import { insertRecipe } from "@/lib/supercomputer/chat";
import { useSuperComputer, type Session } from "@/lib/supercomputer/store";
import { cn } from "@/lib/utils";
import { RECIPES_QUERY } from "./plan-card";

/** Chats, this chat's outputs and running jobs, and saved recipes. */
export function SidePanel({ session }: { session: Session }) {
  const t = useTranslations("sc");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { sessions, localRecipes, newSession, selectSession, deleteSession, setLocalRecipes } = useSuperComputer();
  const runs = useRunsStore((s) => s.runs);

  const { data: serverRecipes, isLoading } = useQuery({
    queryKey: RECIPES_QUERY,
    queryFn: async () => {
      const result = await listRecipes();
      return result.ok ? result.data : null;
    },
  });
  const recipes: Recipe[] = serverRecipes ?? localRecipes;

  const steps = useMemo(() => session.messages.flatMap((m) => m.plan?.steps ?? []), [session.messages]);
  const runIds = new Set(steps.map((s) => s.runId).filter(Boolean));
  const running = runs.filter((r) => runIds.has(r.id) && !isTerminal(r.status)).length;
  const assets = steps.flatMap((s) =>
    s.outputs?.video ? [{ url: s.outputs.video, video: true }] : (s.outputs?.images ?? []).map((url) => ({ url, video: false })),
  );

  const removeRecipe = async (recipe: Recipe) => {
    if (serverRecipes) {
      const result = await deleteRecipe({ id: recipe.id });
      if (!result.ok) return toast.error(result.error.message);
      await queryClient.invalidateQueries({ queryKey: RECIPES_QUERY });
    } else {
      setLocalRecipes(localRecipes.filter((r) => r.id !== recipe.id));
    }
  };

  return (
    <aside className="space-y-4">
      <Section title={t("sessions")}>
        <button
          type="button"
          onClick={() => newSession()}
          className="mb-2 flex h-9 w-full items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 text-xs text-muted hover:border-accent/50 hover:text-foreground"
        >
          <MessageSquarePlus className="size-3.5" />
          {t("newChat")}
        </button>
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                s.id === session.id ? "bg-white/[0.06] text-foreground" : "text-muted hover:bg-white/[0.03]",
              )}
            >
              <button type="button" onClick={() => selectSession(s.id)} className="min-w-0 flex-1 truncate text-start" dir="auto">
                {s.title || t("untitled")}
              </button>
              <span className="shrink-0 text-[10px] text-muted/60">
                {new Date(s.updatedAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
              </span>
              <button
                type="button"
                onClick={() => deleteSession(s.id)}
                aria-label={t("deleteChat")}
                className="shrink-0 text-muted opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={t("session")}
        aside={
          running > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent">
              <Loader2 className="size-3 animate-spin" />
              {t("runningNow", { count: running })}
            </span>
          ) : null
        }
      >
        {assets.length ? (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {assets.slice(0, 12).map((a) => (
                <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-md bg-surface-2">
                  {a.video ? (
                    <video src={a.url} muted playsInline preload="metadata" className="size-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail
                    <img src={a.url} alt="" className="size-full object-cover" />
                  )}
                </a>
              ))}
            </div>
            <Link href="/library" className="mt-2 inline-block text-[11px] text-accent hover:underline">
              {t("openLibrary")}
            </Link>
          </>
        ) : (
          <p className="text-xs text-muted">{t("noAssets")}</p>
        )}
      </Section>

      <Section title={t("recipes")}>
        {isLoading ? (
          <div className="shimmer h-10 rounded-lg" />
        ) : recipes.length ? (
          <div className="space-y-1">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                <BookMarked className="size-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate text-xs" dir="auto">
                  {recipe.name}
                </span>
                <button
                  type="button"
                  onClick={() => insertRecipe(session.id, recipe.name, recipe.plan, t("recipeIntro"))}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10"
                >
                  <Play className="size-3" />
                  {t("useRecipe")}
                </button>
                <button
                  type="button"
                  onClick={() => void removeRecipe(recipe)}
                  aria-label={t("deleteRecipe")}
                  className="text-muted opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">{t("noRecipes")}</p>
        )}
      </Section>
    </aside>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted/80">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
