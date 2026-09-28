"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BookmarkPlus, Loader2, Play, Square, Workflow } from "lucide-react";
import { toast } from "sonner";
import { useKeyDialog } from "@/generation/stores/key-dialog";
import { saveRecipe } from "@/lib/supercomputer/actions";
import { runPlan, stopPlan } from "@/lib/supercomputer/runner";
import { useSuperComputer, type PlanState, type StepState } from "@/lib/supercomputer/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKeyStatus } from "@/components/studio/key-dialog";
import { StepCard } from "./step-card";

export const RECIPES_QUERY = ["sc-recipes"] as const;

/** An editable, runnable plan produced by the planner (or loaded from a recipe). */
export function PlanCard({ sessionId, messageId, plan }: { sessionId: string; messageId: string; plan: PlanState }) {
  const t = useTranslations("sc");
  const sc = useSuperComputer();
  const queryClient = useQueryClient();
  const { data: keyStatus } = useKeyStatus();
  const openKeyDialog = useKeyDialog((s) => s.setOpen);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(plan.title);
  const [saving, setSaving] = useState(false);

  const running = plan.status === "running";
  const generations = plan.steps.filter((s) => s.tool !== "write_script" && s.status !== "done").length;
  const remaining = plan.steps.filter((s) => s.status !== "done").length;
  const keyReady = Boolean(keyStatus?.userKey || keyStatus?.teamKey);

  const onRun = () => {
    if (generations > 0 && keyStatus && !keyReady) {
      openKeyDialog(true);
      toast.error(t("connectKey"));
      return;
    }
    void runPlan(sessionId, messageId);
  };

  const onSave = async () => {
    setSaving(true);
    const recipePlan = {
      title: plan.title,
      // Recipes keep the pipeline, not the results.
      steps: plan.steps.map((s) => ({
        id: s.id,
        tool: s.tool,
        title: s.title,
        model: s.model,
        auto: s.auto,
        prompt: s.prompt,
        settings: s.settings,
        startFrame: s.startFrame,
        endFrame: s.endFrame,
        references: s.references,
      })),
    };
    const result = await saveRecipe({ name, plan: recipePlan });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    if (result.data === null) {
      // Preview mode: keep it in this browser.
      const state = useSuperComputer.getState();
      state.setLocalRecipes([
        { id: crypto.randomUUID(), name: name.trim(), plan: recipePlan, createdAt: Date.now() },
        ...state.localRecipes,
      ]);
    }
    await queryClient.invalidateQueries({ queryKey: RECIPES_QUERY });
    setNaming(false);
    toast.success(t("saved"));
  };

  const editableStep = (step: StepState) => !running && step.status !== "running" && step.status !== "done";

  return (
    <div className="mt-3 rounded-2xl border border-border-strong bg-surface p-4" data-testid="plan-card">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-8 place-items-center rounded-lg bg-accent/15">
          <Workflow className="size-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" dir="auto">
            {plan.title}
          </p>
          <p className="text-[11px] text-muted">
            {t("generations", { count: plan.steps.filter((s) => s.tool !== "write_script").length })} · {t("creditsNote")}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {plan.steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            steps={plan.steps}
            uploads={plan.uploads}
            editable={editableStep(step)}
            onChange={(next) => sc.replaceStep(sessionId, messageId, next)}
            onRemove={() => sc.removeStep(sessionId, messageId, step.id)}
            onRetry={() => void runPlan(sessionId, messageId, step.id)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {running ? (
          <Button variant="secondary" onClick={() => void stopPlan(sessionId, messageId)} data-testid="stop-plan">
            <Square />
            {t("stop")}
          </Button>
        ) : (
          remaining > 0 && (
            <Button onClick={onRun} data-testid="run-plan">
              <Play />
              {t("runAll")}
            </Button>
          )
        )}
        {running && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            {t("running")}
          </span>
        )}
        {!running && remaining === 0 && <span className="text-xs text-success">{t("done")}</span>}

        <div className="ms-auto flex items-center gap-2">
          {naming ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void onSave();
              }}
            >
              <Input
                autoFocus
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("recipeName")}
                aria-label={t("recipeName")}
                className="h-9 w-48"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={saving || !name.trim()}>
                {saving && <Loader2 className="animate-spin" />}
                {t("saveRecipe")}
              </Button>
            </form>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setNaming(true)}>
              <BookmarkPlus />
              {t("saveRecipe")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
