"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Activity, Ban, CheckCircle2, Loader2, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { MODELS } from "@/generation/catalog";
import { isTerminal, type Run } from "@/generation/run-types";
import { useRunsStore } from "@/generation/stores/runs";
import { cancelRun } from "@/lib/studio/runs-controller";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Jobs tray: running generations first, then the most recent finished ones. */
export function JobsTray() {
  const t = useTranslations();
  const runs = useRunsStore((s) => s.runs);
  const running = useMemo(() => runs.filter((r) => !isTerminal(r.status)), [runs]);
  const recent = useMemo(() => runs.filter((r) => isTerminal(r.status)).slice(0, 6), [runs]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-1.5" data-testid="jobs-tray">
          {running.length ? <Loader2 className="animate-spin text-accent" /> : <Activity />}
          <span className="hidden sm:inline">{t("topbar.jobs")}</span>
          {running.length > 0 && (
            <span className="bg-gradient-accent grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white">
              {running.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-2">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-white/5">
              <Activity className="size-4 text-muted" />
            </div>
            <p className="text-sm font-medium">{t("topbar.noJobs")}</p>
            <p className="px-4 text-xs text-muted">{t("topbar.noJobsHint")}</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {running.length > 0 && (
              <Group title={t("jobs.running", { count: running.length })} runs={running} />
            )}
            {recent.length > 0 && <Group title={t("jobs.recent")} runs={recent} />}
            <Link href="/library" className="block rounded-lg px-2 py-2 text-center text-xs text-accent hover:bg-white/5">
              {t("jobs.viewAll")}
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Group({ title, runs }: { title: string; runs: Run[] }) {
  return (
    <div>
      <p className="px-2 pb-1 text-[11px] uppercase tracking-wider text-muted/70">{title}</p>
      {runs.map((run) => (
        <JobRow key={run.id} run={run} />
      ))}
    </div>
  );
}

function JobRow({ run }: { run: Run }) {
  const t = useTranslations("studio");
  const [canceling, setCanceling] = useState(false);
  const label = MODELS.find((m) => m.id === run.model)?.label ?? run.model;
  const thumb = run.outputs?.images?.[0]?.url;
  const busy = !isTerminal(run.status);

  const Icon =
    run.status === "completed"
      ? CheckCircle2
      : run.status === "canceled"
        ? Ban
        : run.status === "nsfw"
          ? ShieldAlert
          : busy
            ? Loader2
            : TriangleAlert;

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
      <Link
        href={run.surface === "image" ? "/image" : "/video"}
        className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <Icon
            className={
              "size-4 " +
              (busy ? "animate-spin text-accent" : run.status === "completed" ? "text-success" : run.status === "canceled" ? "text-muted" : "text-danger")
            }
          />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs" dir="auto">
          {run.prompt || label}
        </p>
        <p className="truncate text-[11px] text-muted">
          <span dir="ltr">{label}</span> · {t(`status.${run.status}`)}
        </p>
      </div>
      {busy && run.requestId && (
        <button
          type="button"
          disabled={canceling}
          aria-label={t("cancel")}
          title={t("cancel")}
          onClick={async () => {
            setCanceling(true);
            const error = await cancelRun(run);
            setCanceling(false);
            if (error) toast.error(error.message);
          }}
          className="grid size-7 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-foreground disabled:opacity-50"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
