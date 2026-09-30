import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import { FlyingBat } from "@/components/brand/flying-bat";

/** Brand mark: the bat inside the logo's neon ring (same artwork as app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("neon-ring relative grid size-9 shrink-0 place-items-center rounded-full bg-black", className)}
      aria-hidden
    >
      <FlyingBat mode="hover" className="w-[72%]" />
    </span>
  );
}

/** Wordmark set like the logo: "THE VIRAL" in the gradient, "EMPIRE" spaced out below. */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("group flex items-center gap-2.5", className)} aria-label={APP_NAME}>
      <LogoMark />
      {!compact && (
        <span className="font-brand flex flex-col leading-none" dir="ltr">
          <span className="text-[15px] font-semibold tracking-[0.06em]">
            <span className="text-[#f5edff]">THE </span>
            <span className="text-gradient">VIRAL</span>
          </span>
          <span className="mt-1 text-[9px] font-medium tracking-[0.66em] text-white/80">EMPIRE</span>
        </span>
      )}
    </div>
  );
}
