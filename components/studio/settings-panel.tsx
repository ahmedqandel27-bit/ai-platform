"use client";

import { useTranslations } from "next-intl";
import type { ModelEntry, SettingField } from "@/generation/catalog/types";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

/**
 * Renders every `model.settings` field from the catalog:
 * enum → segmented control (≤ 5 options) or select, range → slider, boolean → switch.
 */
export function SettingsPanel({
  model,
  values,
  onChange,
}: {
  model: ModelEntry;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const t = useTranslations("studio.setting");
  const label = (key: string) => (t.has(key) ? t(key) : humanize(key));

  return (
    <div className="space-y-4">
      {Object.entries(model.settings).map(([key, field]) => (
        <Field key={key} id={`setting-${key}`} label={label(key)} field={field} value={values[key]} onChange={(v) => onChange(key, v)} />
      ))}
    </div>
  );
}

function Field({
  id,
  label,
  field,
  value,
  onChange,
}: {
  id: string;
  label: string;
  field: SettingField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "boolean") {
    const checked = typeof value === "boolean" ? value : field.default;
    return (
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs text-muted">
          {label}
        </label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.type === "range") {
    const current = typeof value === "number" ? value : field.default;
    const step = field.step ?? 1;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-xs text-muted">
            {label}
          </label>
          <span className="text-xs tabular-nums text-foreground" dir="ltr">
            {Number.isInteger(step) ? current : current.toFixed(2)}
          </span>
        </div>
        <Slider id={id} min={field.min} max={field.max} step={step} value={current} onValueChange={onChange} />
      </div>
    );
  }

  const current = typeof value === "string" && field.values.includes(value) ? value : field.default;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {field.values.length <= 5 ? (
        <div id={id} role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5" dir="ltr">
          {field.values.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === current}
              onClick={() => onChange(option)}
              className={cn(
                "h-8 min-w-12 rounded-lg border px-2.5 text-xs transition-colors",
                option === current
                  ? "border-accent/60 bg-accent/15 text-foreground"
                  : "border-border bg-surface-2 text-muted hover:border-border-strong hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <NativeSelect id={id} value={current} onChange={(e) => onChange(e.target.value)} dir="ltr">
          {field.values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}

function humanize(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
