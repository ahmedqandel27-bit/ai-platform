import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Brand mark: a monogram of the first letter on the accent gradient, the same
 * artwork as the browser-tab icon (app/icon.svg). To use a real logo, swap
 * this component's <svg> and app/icon.svg for the brand files.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-accent relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px] shadow-[0_0_24px_-6px_rgb(139_92_246/0.9)]",
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-px rounded-[9px] bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.35),transparent_60%)]" />
      <span className="font-display relative text-[19px] leading-none text-white" dir="ltr">
        {APP_NAME.charAt(0)}
      </span>
    </span>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="truncate text-[13px] font-medium tracking-[0.22em]" dir="ltr">
          {APP_NAME}
        </span>
      )}
    </div>
  );
}
