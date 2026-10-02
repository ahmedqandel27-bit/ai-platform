"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BookmarkPlus, KeyRound, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { MAX_PROMPT_CHARS } from "@/lib/config";
import { MODELS, parseSettings } from "@/generation/catalog";
import { inferInputMode } from "@/generation/catalog/media-inputs";
import type { Surface } from "@/generation/catalog/types";
import { planeFromRun } from "@/generation/run-types";
import { composerFor } from "@/generation/stores/composer";
import { useKeyDialog } from "@/generation/stores/key-dialog";
import { toPlatform } from "@/generation/to-platform";
import { submitRun } from "@/lib/studio/runs-controller";
import { enhancePrompt, getAssistantStatus } from "@/lib/supercomputer/actions";
import { estimateCost } from "@/lib/team/cost";
import { useProjects, useTeam } from "@/lib/team/use-team";
import { NativeSelect } from "@/components/ui/native-select";
import { PromptDialog, type PromptDraft } from "@/components/prompts/prompt-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useKeyStatus } from "./key-dialog";
import { ModelPicker } from "./model-picker";
import { References } from "./references";
import { SettingsPanel } from "./settings-panel";

/** The studio dock: model, prompt, references, settings and Generate. */
export function Composer({ surface }: { surface: Surface }) {
  const t = useTranslations("studio");
  const useComposer = composerFor(surface);
  const {
    model: modelId,
    prompt,
    settingsByModel,
    media,
    explicitModel,
    projectId,
    setModel,
    applyDefaultModel,
    setProjectId,
    setPrompt,
    setSetting,
    setMedia,
  } = useComposer();
  const { data: team } = useTeam();
  const { data: projects } = useProjects();
  const disabledModels = useMemo(() => team?.settings.disabledModels ?? [], [team]);
  const available = MODELS.filter((m) => m.surface === surface && !disabledModels.includes(m.id));
  const model = available.find((m) => m.id === modelId) ?? available[0];

  // Team rules: a disabled model falls back to the team default; the default
  // also applies until the user picks a model themselves.
  useEffect(() => {
    if (!team) return;
    const fallback = team.settings.defaultModels[surface];
    const current = MODELS.find((m) => m.id === modelId);
    const blocked = !current || disabledModels.includes(modelId);
    if (fallback && (blocked || !explicitModel) && fallback !== modelId) applyDefaultModel(fallback);
    else if (blocked && available[0] && available[0].id !== modelId) applyDefaultModel(available[0].id);
  }, [team, surface, modelId, explicitModel, disabledModels, available, applyDefaultModel]);

  // Forget a project that was deleted or belongs to another team.
  useEffect(() => {
    if (projectId && projects && !projects.some((p) => p.id === projectId)) setProjectId(null);
  }, [projectId, projects, setProjectId]);
  const { data: keyStatus } = useKeyStatus();
  const openKeyDialog = useKeyDialog((s) => s.setOpen);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [promptDraft, setPromptDraft] = useState<PromptDraft | null>(null);
  const { data: assistant } = useQuery({ queryKey: ["assistant-status"], queryFn: () => getAssistantStatus(), staleTime: 5 * 60_000 });

  const rawSettings = useMemo(() => (model ? (settingsByModel[model.id] ?? {}) : {}), [model, settingsByModel]);

  // Same catalog validation the server runs, so problems show before any paid call.
  const check = useMemo(() => {
    if (!model) return { ready: false, problem: null as string | null };
    try {
      const settings = parseSettings(model, rawSettings);
      const inputMode = inferInputMode(model, media);
      toPlatform(planeFromRun({ model: model.id, prompt, settings, media, ...(inputMode ? { inputMode } : {}) }));
      return { ready: true, problem: null };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      // An empty prompt is the normal starting state, not an error worth shouting about.
      const quiet = !prompt.trim() && /prompt/i.test(message);
      return { ready: false, problem: quiet ? null : message };
    }
  }, [model, rawSettings, media, prompt]);

  if (!model) return null;
  const cost = team ? estimateCost(model, parseSettingsSafe(model, rawSettings), team.settings.modelCosts) : null;

  async function enhance() {
    if (!model || !prompt.trim() || enhancing) return;
    setEnhancing(true);
    const result = await enhancePrompt({ prompt, model: model.id });
    setEnhancing(false);
    if (result.ok) setPrompt(result.data.prompt);
    else toast.error(result.error.message);
  }

  const keyReady = Boolean(keyStatus?.userKey || keyStatus?.teamKey);

  async function generate() {
    if (!model || submitting) return;
    if (keyStatus && !keyReady) {
      openKeyDialog(true);
      return;
    }
    if (!check.ready) return;
    setSubmitting(true);
    try {
      const settings = parseSettings(model, rawSettings);
      const inputMode = inferInputMode(model, media);
      await submitRun({
        surface,
        model: model.id,
        prompt: prompt.trim(),
        settings,
        media,
        ...(inputMode ? { inputMode } : {}),
        ...(projectId ? { projectId } : {}),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <PromptDialog draft={promptDraft} onClose={() => setPromptDraft(null)} />
      <section className="space-y-2">
        <h2 className="flex items-baseline gap-2 text-xs font-medium text-muted"><span className="font-display text-[13px] italic text-accent">01</span>{t("model")}</h2>
        <ModelPicker surface={surface} value={model.id} onChange={setModel} disabled={disabledModels} />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={`prompt-${surface}`} className="flex items-baseline gap-2 text-xs font-medium text-muted">
            <span className="font-display text-[13px] italic text-accent">02</span>
            {t("prompt")}
          </label>
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPromptDraft({ title: prompt.trim().slice(0, 60), body: prompt.trim(), tags: [], surface })}
            disabled={!prompt.trim()}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            title={t("savePrompt")}
          >
            <BookmarkPlus className="size-3" />
            {t("savePrompt")}
          </button>
          {assistant?.textTools && (
            <button
              type="button"
              onClick={() => void enhance()}
              disabled={!prompt.trim() || enhancing}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10 disabled:opacity-40"
              data-testid="enhance-prompt"
            >
              {enhancing ? <Loader2 className="size-3 animate-spin" /> : <WandSparkles className="size-3" />}
              {t("enhance")}
            </button>
          )}
          </div>
        </div>
        <Textarea
          id={`prompt-${surface}`}
          rows={5}
          value={prompt}
          maxLength={MAX_PROMPT_CHARS}
          className="max-h-[60vh] min-h-32 resize-y"
          placeholder={surface === "image" ? t("promptPlaceholderImage") : t("promptPlaceholderVideo")}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void generate();
            }
          }}
        />
        {prompt.length > 1000 && (
          <p className="text-end text-[10px] tabular-nums text-muted/70" dir="ltr">
            {prompt.length.toLocaleString("en")} / {MAX_PROMPT_CHARS.toLocaleString("en")}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-baseline gap-2 text-xs font-medium text-muted"><span className="font-display text-[13px] italic text-accent">03</span>{t("references")}</h2>
        <References model={model} media={media} onChange={setMedia} />
      </section>

      {Object.keys(model.settings).length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-baseline gap-2 text-xs font-medium text-muted"><span className="font-display text-[13px] italic text-accent">04</span>{t("settings")}</h2>
          <SettingsPanel model={model} values={rawSettings} onChange={setSetting} />
        </section>
      )}

      {team && projects && projects.length > 0 && (
        <section className="space-y-2">
          <label htmlFor={`project-${surface}`} className="text-xs font-medium text-muted">
            {t("project")}
          </label>
          <NativeSelect
            id={`project-${surface}`}
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value || null)}
          >
            <option value="">{t("noProject")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </section>
      )}

      {team && cost !== null && (
        <p className="text-xs text-muted" data-testid="cost-estimate">
          {t("estimate", { credits: cost })}
        </p>
      )}

      {check.problem && (
        <p role="alert" className="rounded-lg border border-warning/25 bg-warning/10 p-2.5 text-xs text-warning">
          {check.problem}
        </p>
      )}

      {keyStatus && !keyReady ? (
        <Button size="lg" className="w-full" onClick={() => openKeyDialog(true)}>
          <KeyRound />
          {t("connectFirst")}
        </Button>
      ) : (
        <Button size="lg" className="w-full" onClick={() => void generate()} disabled={submitting || !check.ready} data-testid="generate">
          {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {submitting ? t("generating") : t("generate")}
          <kbd className="ms-auto hidden text-[10px] opacity-70 sm:inline">
            <bdi dir="ltr">{t("shortcut")}</bdi>
          </kbd>
        </Button>
      )}
    </Card>
  );
}

function parseSettingsSafe(model: Parameters<typeof parseSettings>[0], raw: Record<string, unknown>) {
  try {
    return parseSettings(model, raw);
  } catch {
    return {};
  }
}
