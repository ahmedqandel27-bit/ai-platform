"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { MODELS } from "@/generation/catalog";
import { FEATURES } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/env";
import { getUsage, type UsageRow } from "@/lib/usage/actions";
import { cn } from "@/lib/utils";
import { RequiresSupabase } from "@/components/common/requires-supabase";
import { DailyChart, type DailyPoint } from "./daily-chart";

type Metric = "credits" | "jobs";

export function UsageView() {
  const t = useTranslations("usage");
  const locale = useLocale();
  const [days, setDays] = useState(30);
  const [metricChoice, setMetric] = useState<Metric | null>(null);
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["usage", days],
    queryFn: async () => {
      const result = await getUsage({ days });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: isSupabaseConfigured,
  });

  const fmt = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const compact = useMemo(() => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }), [locale]);

  const rows = useMemo(() => report?.rows ?? [], [report]);
  const metric: Metric = metricChoice ?? (report?.costsConfigured ? "credits" : "jobs");

  const daily: DailyPoint[] = useMemo(() => {
    if (!report) return [];
    const byDay = new Map<string, { credits: number; jobs: number }>();
    for (const r of rows) {
      const d = byDay.get(r.day) ?? { credits: 0, jobs: 0 };
      d.credits += r.credits;
      d.jobs += r.jobs;
      byDay.set(r.day, d);
    }
    const out: DailyPoint[] = [];
    const start = new Date(`${report.since}T00:00:00Z`);
    const today = new Date();
    for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, value: byDay.get(key)?.[metric] ?? 0 });
    }
    return out;
  }, [report, rows, metric]);

  if (!isSupabaseConfigured) return <RequiresSupabase />;
  if (isLoading) return <div className="shimmer h-96 rounded-2xl" />;
  if (error || !report) return <p className="text-sm text-danger">{error instanceof Error ? error.message : t("loadError")}</p>;

  const totalJobs = rows.reduce((a, r) => a + r.jobs, 0);
  const totalFailed = rows.reduce((a, r) => a + r.failed, 0);
  const totalCredits = rows.reduce((a, r) => a + r.credits, 0);
  const modelLabel = (id: string) => MODELS.find((m) => m.id === id)?.label ?? id;

  const group = (key: (r: UsageRow) => string | null, label: (r: UsageRow) => string) => {
    const map = new Map<string, { label: string; jobs: number; failed: number; credits: number }>();
    for (const r of rows) {
      const k = key(r) ?? "—";
      const g = map.get(k) ?? { label: label(r), jobs: 0, failed: 0, credits: 0 };
      g.jobs += r.jobs;
      g.failed += r.failed;
      g.credits += r.credits;
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => b[metric] - a[metric] || b.jobs - a.jobs);
  };

  const markup = FEATURES.resellerMarkup && report.markupPercent > 0 ? report.markupPercent : 0;

  return (
    <div className="space-y-6">
      {!report.costsConfigured && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-2/60 p-3 text-xs text-muted">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {t("noCosts")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          options={[7, 30, 90].map((d) => ({ value: String(d), label: t("lastDays", { days: d }) }))}
        />
        <Segmented
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          options={[
            { value: "credits", label: t("credits") },
            { value: "jobs", label: t("generations") },
          ]}
        />
        <span className="ms-auto text-xs text-muted">{report.scope === "team" ? t("scopeTeam") : t("scopeSelf")}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BudgetTile
          label={t("monthSpend")}
          value={report.monthSpent}
          limit={report.monthlyBudget}
          fmt={fmt}
          noLimit={t("noBudget")}
          of={(limit) => t("ofLimit", { limit })}
          warn={t("nearLimit")}
          over={t("overLimit")}
        />
        <BudgetTile
          label={t("todayYou")}
          value={report.todaySpent}
          limit={report.dailyCap}
          fmt={fmt}
          noLimit={t("noCap")}
          of={(limit) => t("ofLimit", { limit })}
          warn={t("nearLimit")}
          over={t("overLimit")}
        />
        <StatTile label={t("generationsInRange", { days })} value={compact.format(totalJobs)} />
        <StatTile
          label={markup ? t("billable", { markup }) : t("failureRate")}
          value={
            markup
              ? fmt.format(totalCredits * (1 + markup / 100))
              : totalJobs
                ? `${fmt.format((totalFailed / totalJobs) * 100)}%`
                : "—"
          }
        />
      </div>

      <section className="glass rounded-2xl p-4 sm:p-5">
        <h2 className="text-sm font-medium">{metric === "credits" ? t("creditsPerDay") : t("generationsPerDay")}</h2>
        <p className="mb-4 text-xs text-muted">{t("chartHint")}</p>
        <DailyChart data={daily} format={(v) => fmt.format(v)} unit={metric === "credits" ? t("credits") : t("generations")} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Breakdown title={t("byModel")} rows={group((r) => r.model, (r) => modelLabel(r.model))} metric={metric} fmt={fmt} t={t} ltr />
        <Breakdown title={t("byProject")} rows={group((r) => r.projectId, (r) => r.projectName ?? t("noProject"))} metric={metric} fmt={fmt} t={t} />
        {report.scope === "team" && (
          <Breakdown title={t("byMember")} rows={group((r) => r.userId, (r) => r.email ?? r.userId.slice(0, 8))} metric={metric} fmt={fmt} t={t} ltr />
        )}
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-8 rounded-lg px-3 text-xs transition-colors", value === o.value ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Stat tile + meter. Severity (accent → warning → danger) is also stated in text with an icon. */
function BudgetTile({
  label,
  value,
  limit,
  fmt,
  noLimit,
  of,
  warn,
  over,
}: {
  label: string;
  value: number;
  limit: number | null;
  fmt: Intl.NumberFormat;
  noLimit: string;
  of: (limit: string) => string;
  warn: string;
  over: string;
}) {
  const ratio = limit ? value / limit : 0;
  const level = !limit ? "none" : ratio >= 1 ? "over" : ratio >= 0.8 ? "warn" : "ok";
  return (
    <div className="glass rounded-2xl p-4" data-testid="budget-tile" data-level={level}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt.format(value)}</p>
      <p className="text-xs text-muted">{limit ? of(fmt.format(limit)) : noLimit}</p>
      {limit !== null && limit > 0 && (
        <>
          <div
            className={cn("mt-3 h-1.5 overflow-hidden rounded-full", level === "over" ? "bg-danger/20" : level === "warn" ? "bg-warning/20" : "bg-accent/20")}
            role="meter"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={value}
            aria-label={label}
          >
            <div
              className={cn("h-full rounded-full", level === "over" ? "bg-danger" : level === "warn" ? "bg-warning" : "bg-accent-from")}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
          {level !== "ok" && (
            <p className={cn("mt-2 flex items-center gap-1 text-[11px]", level === "over" ? "text-danger" : "text-warning")}>
              <AlertTriangle className="size-3" />
              {level === "over" ? over : warn}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  metric,
  fmt,
  t,
  ltr = false,
}: {
  title: string;
  rows: { label: string; jobs: number; failed: number; credits: number }[];
  metric: Metric;
  fmt: Intl.NumberFormat;
  t: ReturnType<typeof useTranslations>;
  ltr?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  return (
    <section className="glass rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{t("empty")}</p>
      ) : (
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="text-muted">
              <th className="w-[58%] pb-2 text-start font-normal">{t("name")}</th>
              <th className="truncate pb-2 text-end font-normal">{t("generations")}</th>
              <th className="truncate pb-2 ps-2 text-end font-normal">{t("credits")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="min-w-0 py-2 pe-3">
                  <span className="block truncate" dir={ltr ? "ltr" : "auto"} title={r.label}>
                    {r.label}
                  </span>
                  <span className="mt-1 block h-1 rounded-full bg-accent-from/80" style={{ width: `${(r[metric] / max) * 100}%` }} />
                </td>
                <td className="py-2 text-end tabular-nums">
                  {fmt.format(r.jobs)}
                  {r.failed > 0 && <span className="text-muted"> ({fmt.format(r.failed)}✕)</span>}
                </td>
                <td className="py-2 ps-2 text-end tabular-nums">{fmt.format(r.credits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
