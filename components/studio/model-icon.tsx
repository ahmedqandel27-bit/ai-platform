import type { ModelEntry } from "@/generation/catalog/types";
import { cn } from "@/lib/utils";

/** Brand mark from /public/model-icons, or the model's initial. */
export function ModelIcon({ model, className }: { model: ModelEntry; className?: string }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white/[0.04]", className)}>
      {model.icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny local svg (currentColor renders black in <img>; invert for the dark theme)
        <img src={`/model-icons/${model.icon}.svg`} alt="" className="size-4 opacity-90 invert" />
      ) : (
        <span className="text-xs font-semibold text-muted">{model.label[0]}</span>
      )}
    </span>
  );
}
