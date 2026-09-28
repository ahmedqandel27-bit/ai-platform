"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, Sparkles } from "lucide-react";
import { MODELS, parseSettings } from "@/generation/catalog";
import { inferInputMode } from "@/generation/catalog/media-inputs";
import type { Surface } from "@/generation/catalog/types";
import { planeFromRun } from "@/generation/run-types";
import { composerFor } from "@/generation/stores/composer";
import { useKeyDialog } from "@/generation/stores/key-dialog";
import { toPlatform } from "@/generation/to-platform";
import { submitRun } from "@/lib/studio/runs-controller";
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
  const { model: modelId, prompt, settingsByModel, media, setModel, setPrompt, setSetting, setMedia } = useComposer();
  const model = MODELS.find((m) => m.id === modelId && m.surface === surface) ?? MODELS.find((m) => m.surface === surface);
  const { data: keyStatus } = useKeyStatus();
  const openKeyDialog = useKeyDialog((s) => s.setOpen);
  const [submitting, setSubmitting] = useState(false);

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
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <section className="space-y-2">
        <h2 className="text-xs font-medium text-muted">{t("model")}</h2>
        <ModelPicker surface={surface} value={model.id} onChange={setModel} />
      </section>

      <section className="space-y-2">
        <label htmlFor={`prompt-${surface}`} className="text-xs font-medium text-muted">
          {t("prompt")}
        </label>
        <Textarea
          id={`prompt-${surface}`}
          rows={5}
          value={prompt}
          maxLength={5000}
          placeholder={surface === "image" ? t("promptPlaceholderImage") : t("promptPlaceholderVideo")}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void generate();
            }
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium text-muted">{t("references")}</h2>
        <References model={model} media={media} onChange={setMedia} />
      </section>

      {Object.keys(model.settings).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium text-muted">{t("settings")}</h2>
          <SettingsPanel model={model} values={rawSettings} onChange={setSetting} />
        </section>
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
          <kbd className="ms-auto hidden text-[10px] opacity-70 sm:inline" dir="ltr">
            {t("shortcut")}
          </kbd>
        </Button>
      )}
    </Card>
  );
}
