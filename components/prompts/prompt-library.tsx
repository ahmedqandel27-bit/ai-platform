"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Clapperboard, Copy, Image as ImageIcon, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MODELS } from "@/generation/catalog";
import { composerFor } from "@/generation/stores/composer";
import { loadIntoComposer } from "@/generation/stores/handoff";
import { deletePrompt, listPrompts, type SavedPrompt } from "@/lib/prompts/actions";
import { useLocalPrompts } from "@/lib/prompts/local-store";
import { STARTER_PROMPTS, type StarterCategory } from "@/lib/prompts/starters";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROMPTS_QUERY, PromptDialog, type PromptDraft } from "./prompt-dialog";

type Tab = "team" | "starter";
type SurfaceFilter = "all" | "image" | "video";
type Card = { key: string; title: string; body: string; tags: string[]; surface: "image" | "video" | "any"; saved?: SavedPrompt };

/** Loads a prompt into the matching studio's composer and opens it. */
function usePromptLoader() {
  const router = useRouter();
  return (body: string, surface: Card["surface"]) => {
    const target = surface === "video" ? "video" : "image";
    const composer = composerFor(target).getState();
    const model = MODELS.some((m) => m.id === composer.model && m.surface === target)
      ? composer.model
      : (MODELS.find((m) => m.surface === target)?.id ?? composer.model);
    loadIntoComposer(target, { model, prompt: body, media: [] });
    router.push(`/${target}`);
  };
}

export function PromptLibrary() {
  const t = useTranslations("prompts");
  const locale = useLocale() as "ar" | "en";
  const queryClient = useQueryClient();
  const applyPrompt = usePromptLoader();
  const [tab, setTab] = useState<Tab>("starter");
  const [query, setQuery] = useState("");
  const [surface, setSurface] = useState<SurfaceFilter>("all");
  const [category, setCategory] = useState<StarterCategory | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptDraft | null>(null);
  const localPrompts = useLocalPrompts((s) => s.prompts);

  const { data: serverPrompts } = useQuery({
    queryKey: PROMPTS_QUERY,
    queryFn: async () => {
      const result = await listPrompts();
      return result.ok ? result.data : null;
    },
  });
  const saved: SavedPrompt[] = serverPrompts ?? localPrompts;

  const cards: Card[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base: Card[] =
      tab === "starter"
        ? STARTER_PROMPTS.filter((p) => category === "all" || p.category === category).map((p) => ({
            key: p.id,
            title: p.title[locale],
            body: p.body[locale],
            tags: [p.category],
            surface: p.surface,
          }))
        : saved
            .filter((p) => !tag || p.tags.includes(tag))
            .map((p) => ({ key: p.id, title: p.title, body: p.body, tags: p.tags, surface: p.surface, saved: p }));
    return base.filter(
      (c) =>
        (surface === "all" || c.surface === surface || c.surface === "any") &&
        (!q || c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q) || c.tags.some((x) => x.includes(q))),
    );
  }, [tab, category, saved, tag, query, surface, locale]);

  const allTags = useMemo(() => [...new Set(saved.flatMap((p) => p.tags))].sort(), [saved]);

  const onDelete = async (prompt: SavedPrompt) => {
    if (!window.confirm(t("confirmDelete"))) return;
    if (serverPrompts) {
      const result = await deletePrompt({ id: prompt.id });
      if (!result.ok) return toast.error(result.error);
      await queryClient.invalidateQueries({ queryKey: PROMPTS_QUERY });
    } else {
      useLocalPrompts.getState().remove(prompt.id);
    }
  };

  const chip = (active: boolean) =>
    cn(
      "h-8 rounded-lg px-3 text-xs transition-colors",
      active ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground",
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
          <button role="tab" aria-selected={tab === "starter"} onClick={() => setTab("starter")} className={chip(tab === "starter")}>
            {t("starter")}
          </button>
          <button role="tab" aria-selected={tab === "team"} onClick={() => setTab("team")} className={chip(tab === "team")}>
            {serverPrompts ? t("team") : t("mine")} · {saved.length}
          </button>
        </div>
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="h-9 ps-9" />
        </div>
        <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
          {(["all", "image", "video"] as const).map((s) => (
            <button key={s} onClick={() => setSurface(s)} className={chip(surface === s)} aria-pressed={surface === s}>
              {t(s === "all" ? "any" : s)}
            </button>
          ))}
        </div>
        <Button className="ms-auto" onClick={() => setDraft({ title: "", body: "", tags: [], surface: "any" })}>
          <Plus />
          {t("new")}
        </Button>
      </div>

      {tab === "starter" ? (
        <div className="flex flex-wrap gap-1.5">
          {(["all", "ads", "ugc", "product", "cinematic", "fashion"] as const).map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={cn(chip(category === c), "border border-border")} aria-pressed={category === c}>
              {t(`categories.${c}`)}
            </button>
          ))}
        </div>
      ) : (
        allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTag(null)} className={cn(chip(tag === null), "border border-border")}>
              {t("categories.all")}
            </button>
            {allTags.map((x) => (
              <button key={x} onClick={() => setTag(x)} className={cn(chip(tag === x), "border border-border")} dir="auto">
                #{x}
              </button>
            ))}
          </div>
        )
      )}

      {cards.length === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
          {tab === "team" && !saved.length ? t("emptySaved") : t("noResults")}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="prompt-cards">
          {cards.map((card) => (
            <article key={card.key} className="glass flex flex-col rounded-2xl p-4" data-testid="prompt-card">
              <div className="flex items-start gap-2">
                {card.surface === "video" ? (
                  <Clapperboard className="mt-0.5 size-4 shrink-0 text-accent" />
                ) : (
                  <ImageIcon className="mt-0.5 size-4 shrink-0 text-accent" />
                )}
                <h3 className="min-w-0 flex-1 text-sm font-medium" dir="auto">
                  {card.title}
                </h3>
              </div>
              <p className="mt-2 line-clamp-4 flex-1 text-[13px] leading-relaxed text-muted" dir="auto">
                {card.body}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {card.tags.map((x) => (
                  <Badge key={x} dir="auto">
                    {tab === "starter" ? t(`categories.${x}`) : `#${x}`}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
                <Button size="sm" onClick={() => applyPrompt(card.body, card.surface)} data-testid="use-prompt">
                  <Sparkles />
                  {t("use")}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(card.body);
                    toast.success(t("copied"));
                  }}
                  className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-foreground"
                  aria-label={t("copy")}
                  title={t("copy")}
                >
                  <Copy className="size-3.5" />
                </button>
                {tab === "starter" && (
                  <button
                    type="button"
                    onClick={() => setDraft({ title: card.title, body: card.body, tags: card.tags, surface: card.surface })}
                    className="ms-auto text-xs text-muted hover:text-foreground"
                  >
                    {t("saveCopy")}
                  </button>
                )}
                {card.saved?.mine && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...card.saved!, tags: card.saved!.tags })}
                      className="ms-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-foreground"
                      aria-label={t("edit")}
                      title={t("edit")}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(card.saved!)}
                      className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-danger"
                      aria-label={t("delete")}
                      title={t("delete")}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <PromptDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}
