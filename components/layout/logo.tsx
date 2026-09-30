import { APP_NAME } from "@/lib/config";
import { BAT_PATH, BAT_VIEWBOX } from "@/components/brand/bat";
import { cn } from "@/lib/utils";

/** The bat on its own, filled with the brand gradient. */
export function Bat({ className }: { className?: string }) {
  return (
    <svg viewBox={BAT_VIEWBOX} className={className} aria-hidden>
      <defs>
        <linearGradient id="bat-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b56bff" />
          <stop offset="1" stopColor="#5b0fe0" />
        </linearGradient>
      </defs>
      <path d={BAT_PATH} fill="url(#bat-fill)" fillRule="evenodd" />
    </svg>
  );
}

/** Brand mark: the bat inside the logo's neon ring (same artwork as app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("neon-ring relative grid size-9 shrink-0 place-items-center rounded-full bg-black", className)}
      aria-hidden
    >
      <Bat className="w-[72%] drop-shadow-[0_0_4px_rgb(144_24_240/0.9)]" />
    </span>
  );
}

/** Wordmark set like the logo: "THE VIRAL" in the gradient, "EMPIRE" spaced out below. */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label={APP_NAME}>
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
