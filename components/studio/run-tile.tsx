"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Ban, Clapperboard, Download, Loader2, RotateCcw, ShieldAlert, Trash2, TriangleAlert, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { MODELS } from "@/generation/catalog";
import { isTerminal, type Run } from "@/generation/run-types";
import { cancelRun, removeRun, submitRun } from "@/lib/studio/runs-controller";
import { aspectOf, downloadMedia } from "@/lib/studio/media";
import { cn } from "@/lib/utils";
import { animate, remix } from "./run-actions";

export function useErrorText() {
  const t = useTranslations("studio.errors");
  return (run: Run) => {
    const code = run.error?.code;
    if (code && t.has(code)) {
      // Validation / platform messages carry the specific reason; keep them.
      return code === "invalid_input" || code === "platform_error" ? (run.error?.message ?? "") : t(code);
    }
    return run.error?.message ?? "";
  };
}

/** The only renderer for one generation (feed, library, detail). */
export function RunTile({ run, onOpen }: { run: Run; onOpen: (run: Run) => void }) {
  const t = useTranslations("studio");
  const router = useRouter();
  const errorText = useErrorText();
  const [canceling, setCanceling] = useState(false);
  const modelLabel = MODELS.find((m) => m.id === run.model)?.label ?? run.model;
  const busy = !isTerminal(run.status);
  const images = run.outputs?.images ?? [];
  const video = run.outputs?.video;
  const done = run.status === "completed" && (images.length > 0 || video);

  const onCancel = async () => {
    setCanceling(true);
    const error = await cancelRun(run);
    setCanceling(false);
    if (error) toast.error(error.message);
  };

  const onRetry = () => {
    void submitRun({
      surface: run.surface,
      model: run.model,
      prompt: run.prompt,
      settings: run.settings,
      media: run.media,
      ...(run.inputMode ? { inputMode: run.inputMode } : {}),
    });
  };

  const onRemix = () => {
    remix(run);
    router.push(run.surface === "image" ? "/image" : "/video");
    toast.success(t("copied"));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface"
      style={{ aspectRatio: aspectOf(run.settings, run.surface === "image" ? "1:1" : "16:9") }}
      data-testid="run-tile"
      data-status={run.status}
    >
      {done ? (
        <button type="button" onClick={() => onOpen(run)} className="absolute inset-0 size-full" aria-label={t("open")}>
          {video ? (
            <video
              src={video.url}
              muted
              loop
              playsInline
              preload="metadata"
              className="size-full object-cover"
              onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => e.currentTarget.pause()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- remote generated media
            <img src={images[0]!.url} alt={run.prompt} loading="lazy" className="size-full object-cover" />
          )}
          {images.length > 1 && (
            <span className="absolute end-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">
              {t("images", { count: images.length })}
            </span>
          )}
        </button>
      ) : busy ? (
        <div className="shimmer absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Loader2 className="size-5 animate-spin text-accent" />
            <p className="text-xs font-medium">{t(`status.${run.status}`)}</p>
            <p className="line-clamp-2 text-[11px] text-muted">{run.prompt}</p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(run)}
          className="absolute inset-0 grid place-items-center bg-surface-2/60 px-5 text-center"
        >
          <div className="flex flex-col items-center gap-2">
            {run.status === "canceled" ? (
              <Ban className="size-5 text-muted" />
            ) : run.status === "nsfw" ? (
              <ShieldAlert className="size-5 text-warning" />
            ) : (
              <TriangleAlert className="size-5 text-danger" />
            )}
            <p className="text-xs font-medium">{t(`status.${run.status}`)}</p>
            {run.status !== "canceled" && <p className="line-clamp-3 text-[11px] text-muted">{errorText(run)}</p>}
          </div>
        </button>
      )}

      {/* Footer: model + status + actions */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5 pt-8">
        <span className="truncate text-[11px] text-white/80" dir="ltr">
          {modelLabel}
        </span>
        <div className="pointer-events-auto flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {busy && run.requestId && (
            <TileButton label={canceling ? t("canceling") : t("cancel")} onClick={onCancel} disabled={canceling}>
              <X />
            </TileButton>
          )}
          {done && (
            <TileButton
              label={t("download")}
              onClick={() => void downloadMedia(video?.url ?? images[0]!.url, `nexus-${run.id.slice(0, 8)}`)}
            >
              <Download />
            </TileButton>
          )}
          {done && run.surface === "image" && (
            <TileButton
              label={t("animate")}
              onClick={() => {
                animate(images[0]!.url, run.prompt);
                router.push("/video");
              }}
            >
              <Clapperboard />
            </TileButton>
          )}
          {!busy && (
            <TileButton label={t("remix")} onClick={onRemix}>
              <Wand2 />
            </TileButton>
          )}
          {!busy && run.status !== "completed" && (
            <TileButton label={t("retry")} onClick={onRetry}>
              <RotateCcw />
            </TileButton>
          )}
          {!busy && (
            <TileButton label={t("delete")} onClick={() => void removeRun(run)}>
              <Trash2 />
            </TileButton>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TileButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/85 disabled:opacity-50 [&_svg]:size-3.5",
      )}
    >
      {children}
    </button>
  );
}
