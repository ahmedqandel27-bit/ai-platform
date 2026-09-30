import { BAT_PATH, BAT_VIEWBOX } from "@/components/brand/bat";
import { cn } from "@/lib/utils";

function Half({ side, fill }: { side: "l" | "r"; fill: string }) {
  return (
    <span className={cn("bat-wing", side === "l" ? "bat-wing-l" : "bat-wing-r")}>
      <svg
        viewBox={BAT_VIEWBOX}
        className="block h-full w-[200%] max-w-none"
        style={side === "r" ? { marginLeft: "-100%" } : undefined}
      >
        <path d={BAT_PATH} fill={fill} fillRule="evenodd" />
      </svg>
    </span>
  );
}

/**
 * Shared gradient for every bat on the page. Rendered once at the root, never
 * inside anything that can be display:none (a gradient defined there stops
 * painting for every other element that references it).
 */
export function BatDefs() {
  return (
    <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden>
      <defs>
        <linearGradient id="bat-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b56bff" />
          <stop offset="1" stopColor="#5b0fe0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The bat in flight: the silhouette is split down the body and each half
 * rotates in 3D around the centre line, so the wings beat. Pure CSS (see
 * .bat-fly in globals.css), so it works in server components and costs no JS.
 *
 * mode: "fly" beats continuously; "hover" glides and beats on parent :hover.
 */
export function FlyingBat({
  mode = "fly",
  fill = "url(#bat-grad)",
  className,
}: {
  mode?: "fly" | "hover";
  fill?: string;
  className?: string;
}) {
  return (
    <span className={cn("bat-fly", mode === "hover" && "bat-fly-hover", className)} dir="ltr" aria-hidden>
      <Half side="l" fill={fill} />
      <Half side="r" fill={fill} />
    </span>
  );
}
