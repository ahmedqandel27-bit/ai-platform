"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { MODELS } from "@/generation/catalog";
import type { ModelEntry, Surface } from "@/generation/catalog/types";
import { capabilities } from "@/lib/studio/media";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModelIcon } from "./model-icon";

/** Lists EVERY installed model for the surface, straight from the catalog. */
export function ModelPicker({
  surface,
  value,
  onChange,
}: {
  surface: Surface;
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("studio");
  const models = MODELS.filter((m) => m.surface === surface);
  const current = models.find((m) => m.id === value) ?? models[0];
  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 p-2 pe-3 text-start transition-colors hover:border-border-strong"
          data-testid="model-picker"
        >
          <ModelIcon model={current} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" dir="ltr">
              {current.label}
            </p>
            <Caps model={current} />
          </div>
          <ChevronDown className="size-4 text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(70vh,560px)] w-[var(--radix-dropdown-menu-trigger-width)] min-w-72 overflow-y-auto"
      >
        <DropdownMenuLabel>
          {t("model")} · {models.length}
        </DropdownMenuLabel>
        {models.map((model) => (
          <DropdownMenuItem key={model.id} onSelect={() => onChange(model.id)} className="items-start gap-3 py-2">
            <ModelIcon model={model} className="size-7" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm" dir="ltr">
                {model.label}
              </p>
              <Caps model={model} />
            </div>
            {model.id === current.id && <Check className="mt-1 !text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Caps({ model }: { model: ModelEntry }) {
  const t = useTranslations("studio.caps");
  return (
    <p className={cn("mt-0.5 truncate text-[11px] text-muted")}>
      {capabilities(model)
        .map((cap) => t(cap))
        .join(" · ")}
    </p>
  );
}
