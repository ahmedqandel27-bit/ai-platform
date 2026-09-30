import { FlyingBat } from "@/components/brand/flying-bat";

/** Runs before first paint: the splash plays once per browser session. */
const ONCE_PER_SESSION = `try{if(sessionStorage.getItem("tve-splash"))document.documentElement.dataset.splash="off";else sessionStorage.setItem("tve-splash","1")}catch(e){}`;

export function SplashScript() {
  return <script dangerouslySetInnerHTML={{ __html: ONCE_PER_SESSION }} />;
}

/**
 * Opening sequence: the neon ring draws itself, the bat flies in beating its
 * wings, the wordmark rises, then the whole layer dissolves (~1.8s). CSS
 * only, so it starts with the first paint, before any JS has loaded.
 */
export function Splash() {
  return (
    <div className="splash" aria-hidden>
      <div className="splash-glow" />
      <div className="relative grid place-items-center">
        <svg viewBox="0 0 200 200" className="splash-ring absolute size-44">
          <circle cx="100" cy="100" r="96" pathLength="1" />
        </svg>
        <div className="grid size-44 place-items-center">
          <FlyingBat className="splash-bat w-28" />
        </div>
      </div>
      <div className="splash-word font-brand mt-7 flex flex-col items-center leading-none" dir="ltr">
        <span className="text-[26px] font-semibold tracking-[0.06em]">
          <span className="text-[#f5edff]">THE </span>
          <span className="text-gradient">VIRAL</span>
        </span>
        <span className="mt-2 text-[12px] font-medium tracking-[0.7em] text-white/80">EMPIRE</span>
      </div>
    </div>
  );
}
