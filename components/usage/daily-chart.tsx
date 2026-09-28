"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

export type DailyPoint = { day: string; value: number };

const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 40 };

/** Clean axis ticks: 0 and ~4 round steps up to the max. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Math.round(v * 100) / 100);
  if (out[out.length - 1]! < max) out.push(out[out.length - 1]! + step);
  return out;
}

/**
 * Single-series column chart (one hue, no legend — the heading names it).
 * Columns ≤ 24px with a 4px rounded top, hairline grid, per-column hover
 * tooltip with a full-height hit target, and a table view for accessibility.
 */
export function DailyChart({ data, format, unit }: { data: DailyPoint[]; format: (v: number) => string; unit: string }) {
  const t = useTranslations("usage");
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const width = 720;
  const max = Math.max(0, ...data.map((d) => d.value));
  const yTicks = useMemo(() => ticks(max), [max]);
  const top = yTicks[yTicks.length - 1]!;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(2, band - 2));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const labelEvery = Math.ceil(data.length / 7);

  return (
    <div>
      <div className="relative" dir="ltr">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${unit} · ${data.length}d`}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.07)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--muted)">
                {format(v)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const h = Math.max(0, PAD.top + innerH - y(d.value));
            const r = Math.min(4, barW / 2, h);
            const base = PAD.top + innerH;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* Full-height hit target, larger than the mark */}
                <rect x={PAD.left + i * band} y={PAD.top} width={band} height={innerH} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`}
                    fill="var(--accent-from)"
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={PAD.left + i * band + band / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
                    {dayLabel(d.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-xl"
            style={{ left: `${((PAD.left + hover * band + band / 2) / width) * 100}%` }}
          >
            <p className="text-muted">{dayLabel(data[hover].day)}</p>
            <p className="font-medium tabular-nums">
              {format(data[hover].value)} {unit}
            </p>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setShowTable((v) => !v)} className="mt-2 text-[11px] text-muted hover:text-foreground">
        {showTable ? t("hideTable") : t("showTable")}
      </button>
      {showTable && (
        <div className="mt-2 max-h-60 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="py-1.5">{dayLabel(d.day)}</td>
                  <td className="py-1.5 text-end tabular-nums">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
