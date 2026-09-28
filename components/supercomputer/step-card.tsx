"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  SkipForward,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { MODELS, getModel } from "@/generation/catalog";
import { autoPick, coerceSettings, reconcileStep, surfaceOf, type Ref } from "@/lib/supercomputer/plan";
import type { StepState } from "@/lib/supercomputer/store";
import { useTeam } from "@/lib/team/use-team";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { SettingsPanel } from "@/components/studio/settings-panel";

const TOOL_ICON = { generate_image: ImageIcon, generate_video: Clapperboard, write_script: FileText } as const;

export function StepCard({
  step,
  index,
  steps,
  uploads,
  editable,
  onChange,
  onRemove,
  onRetry,
}: {
  step: StepState;
  index: number;
  steps: StepState[];
  uploads: Array<{ url: string }>;
  editable: boolean;
  onChange: (step: StepState) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("sc");
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = TOOL_ICON[step.tool];
  const surface = surfaceOf(step.tool);
  const model = step.model ? MODELS.find((m) => m.id === step.model) : undefined;
  const { data: team } = useTeam();
  const disabled = team?.settings.disabledModels ?? [];
  const surfaceModels = surface ? MODELS.filter((m) => m.surface === surface && !disabled.includes(m.id)) : [];

  const autoLabel = () => {
    if (!surface) return t("auto");
    const picked = autoPick(
      surface,
      { start: Boolean(step.startFrame), end: Boolean(step.endFrame), refs: step.references.length },
      disabled,
    );
    return picked ? t("autoWith", { model: picked.label }) : t("auto");
  };

  const describeRef = (ref: Ref) => {
    if (ref.type === "upload") return { label: t("fromUpload", { n: ref.index + 1 }), thumb: uploads[ref.index]?.url };
    const source = steps.find((s) => s.id === ref.id);
    return { label: t("fromStep", { title: source?.title ?? ref.id }), thumb: source?.outputs?.images?.[0] };
  };

  const inputs: Array<{ kind: string; ref: Ref }> = [
    ...(step.startFrame ? [{ kind: t("startFrom"), ref: step.startFrame }] : []),
    ...(step.endFrame ? [{ kind: t("endFrom"), ref: step.endFrame }] : []),
    ...step.references.map((ref) => ({ kind: t("referenceFrom"), ref })),
  ];

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-2/60 p-3.5",
        step.status === "running" ? "border-accent/50" : step.status === "failed" ? "border-danger/40" : "border-border",
      )}
      data-testid="plan-step"
      data-status={step.status}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white/5 text-[11px] font-semibold text-muted">
          {index + 1}
        </span>
        <Icon className="size-4 shrink-0 text-accent" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{step.title}</p>
        <StatusChip status={step.status} />
        {editable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("removeStep")}
            title={t("removeStep")}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {surface && (
          <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
            <label className="text-xs text-muted" htmlFor={`model-${step.id}`}>
              {t("model")}
            </label>
            <NativeSelect
              id={`model-${step.id}`}
              dir="ltr"
              disabled={!editable}
              value={step.auto ? "auto" : step.model}
              onChange={(e) => onChange({ ...reconcileStep(step, e.target.value, disabled), status: step.status } as StepState)}
            >
              <option value="auto">{autoLabel()}</option>
              {surfaceModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-muted" htmlFor={`prompt-${step.id}`}>
            {step.tool === "write_script" ? t("brief") : t("prompt")}
          </label>
          <Textarea
            id={`prompt-${step.id}`}
            rows={3}
            dir="auto"
            disabled={!editable}
            value={step.prompt}
            maxLength={5000}
            onChange={(e) => onChange({ ...step, prompt: e.target.value })}
            className="text-[13px] disabled:opacity-80"
          />
        </div>

        {inputs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted">{t("inputs")}</p>
            <div className="flex flex-wrap gap-2">
              {inputs.map(({ kind, ref }, i) => {
                const { label, thumb } = describeRef(ref);
                return (
                  <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-[11px]">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail
                      <img src={thumb} alt="" className="size-5 rounded object-cover" />
                    ) : (
                      <ImageIcon className="size-3.5 text-muted" />
                    )}
                    <span className="text-muted">{kind}</span>
                    <span>{label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {model && Object.keys(model.settings).length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
              aria-expanded={showSettings}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showSettings && "rotate-180")} />
              {t("settings")}
              <span dir="ltr" className="text-muted/70">
                · {Object.values(step.settings).map(String).join(" · ")}
              </span>
            </button>
            {showSettings && (
              <div className={cn("mt-3", !editable && "pointer-events-none opacity-70")}>
                <SettingsPanel
                  model={getModel(step.model)}
                  values={step.settings}
                  onChange={(key, value) =>
                    onChange({ ...step, settings: coerceSettings(getModel(step.model), { ...step.settings, [key]: value }) })
                  }
                />
              </div>
            )}
          </div>
        )}

        <StepOutput step={step} />

        {step.error && (
          <p className="flex items-start gap-1.5 text-xs text-danger">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {step.error}
          </p>
        )}

        {(step.status === "failed" || step.status === "skipped") && editable && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
            <RotateCcw className="size-3.5" />
            {t("retry")}
          </button>
        )}

        {step.text && (
          <div className="relative rounded-lg border border-border bg-surface p-3">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(step.text ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted hover:bg-white/5 hover:text-foreground"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? t("copied") : t("copy")}
            </button>
            <p dir="auto" className="whitespace-pre-wrap pt-5 text-[13px] leading-relaxed">
              {step.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepOutput({ step }: { step: StepState }) {
  if (step.status === "running" && step.tool !== "write_script")
    return <div className="shimmer h-40 rounded-lg" aria-busy="true" />;
  if (step.outputs?.video)
    return <video src={step.outputs.video} controls loop playsInline className="max-h-80 w-full rounded-lg bg-black" />;
  if (step.outputs?.images?.length)
    return (
      <div className={cn("grid gap-2", step.outputs.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {step.outputs.images.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote generated media */}
            <img src={url} alt={step.title} className="max-h-80 w-full object-cover" />
          </a>
        ))}
      </div>
    );
  return null;
}

function StatusChip({ status }: { status: StepState["status"] }) {
  const t = useTranslations("sc.stepStatus");
  const styles: Record<StepState["status"], string> = {
    idle: "bg-white/5 text-muted",
    running: "bg-accent/15 text-accent",
    done: "bg-success/15 text-success",
    failed: "bg-danger/15 text-danger",
    skipped: "bg-white/5 text-muted",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", styles[status])}>
      {status === "running" && <Loader2 className="size-3 animate-spin" />}
      {status === "done" && <Check className="size-3" />}
      {status === "skipped" && <SkipForward className="size-3" />}
      {t(status)}
    </span>
  );
}
