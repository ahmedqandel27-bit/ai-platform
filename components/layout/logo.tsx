import { Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="bg-gradient-accent grid size-8 shrink-0 place-items-center rounded-lg shadow-[0_0_20px_-4px_rgb(139_92_246/0.8)]">
        <Sparkles className="size-4 text-white" />
      </div>
      {!compact && (
        <span className="truncate text-sm font-semibold tracking-[0.18em]" dir="ltr">
          {APP_NAME}
        </span>
      )}
    </div>
  );
}
