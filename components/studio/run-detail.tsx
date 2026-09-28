"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clapperboard, Download, Wand2 } from "lucide-react";
import { MODELS } from "@/generation/catalog";
import type { Run } from "@/generation/run-types";
import { downloadMedia } from "@/lib/studio/media";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { animate, remix } from "./run-actions";
import { useErrorText } from "./run-tile";

/** Lightbox for one generation: media, prompt, model, settings, request id. */
export function RunDetail({ run, onClose }: { run: Run | null; onClose: () => void }) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  if (!run) return null;

  const modelLabel = MODELS.find((m) => m.id === run.model)?.label ?? run.model;
  const images = run.outputs?.images ?? [];
  const video = run.outputs?.video;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("remove")} className="max-h-[90dvh] max-w-5xl overflow-y-auto p-0">
        <div className="grid gap-0 md:grid-cols-[1fr_300px]">
          <div className="flex min-h-64 items-center justify-center bg-black/60 p-3">
            {video ? (
              <video src={video.url} controls autoPlay loop playsInline className="max-h-[80dvh] w-full rounded-lg" />
            ) : images.length ? (
              <div className={images.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
                {images.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element -- remote generated media
                  <img key={image.url} src={image.url} alt={run.prompt} className="max-h-[80dvh] w-full rounded-lg object-contain" />
                ))}
              </div>
            ) : (
              <p className="max-w-sm p-6 text-center text-sm text-muted">
                {t(`status.${run.status}`)} — {errorText(run)}
              </p>
            )}
          </div>

          <div className="space-y-5 p-5">
            <div>
              <DialogTitle dir="ltr" className="text-start">
                {modelLabel}
              </DialogTitle>
              <DialogDescription>{t(`status.${run.status}`)}</DialogDescription>
            </div>

            {run.prompt && (
              <section>
                <h3 className="mb-1 text-xs text-muted">{t("prompt")}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{run.prompt}</p>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs text-muted">{t("settings")}</h3>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {Object.entries(run.settings).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-muted">{t.has(`setting.${key}`) ? t(`setting.${key}`) : key}</dt>
                    <dd dir="ltr" className="text-end">
                      {String(value)}
                    </dd>
                  </div>
                ))}
                {run.media.length > 0 && (
                  <>
                    <dt className="text-muted">{t("references")}</dt>
                    <dd className="text-end">{run.media.length}</dd>
                  </>
                )}
              </dl>
            </section>

            <dl className="space-y-1 text-[11px] text-muted">
              <div className="flex justify-between gap-2">
                <dt>{t("created")}</dt>
                <dd>{new Date(run.createdAt).toLocaleString(locale)}</dd>
              </div>
              {run.requestId && (
                <div className="flex justify-between gap-2">
                  <dt>{t("requestId")}</dt>
                  <dd dir="ltr" className="truncate font-mono">
                    {run.requestId}
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex flex-wrap gap-2">
              {(video || images.length > 0) &&
                (video ? [video.url] : images.map((i) => i.url)).map((url, index, all) => (
                  <Button
                    key={url}
                    variant="secondary"
                    size="sm"
                    onClick={() => void downloadMedia(url, `nexus-${run.id.slice(0, 8)}-${index + 1}`)}
                  >
                    <Download />
                    {t("download")}
                    {all.length > 1 ? ` ${index + 1}` : ""}
                  </Button>
                ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  remix(run);
                  onClose();
                  router.push(run.surface === "image" ? "/image" : "/video");
                }}
              >
                <Wand2 />
                {t("remix")}
              </Button>
              {run.surface === "image" && images[0] && (
                <Button
                  size="sm"
                  onClick={() => {
                    animate(images[0]!.url, run.prompt);
                    onClose();
                    router.push("/video");
                  }}
                >
                  <Clapperboard />
                  {t("animate")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
