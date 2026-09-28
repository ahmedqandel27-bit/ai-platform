"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { Run } from "@/generation/run-types";
import { RunDetail } from "./run-detail";
import { RunTile } from "./run-tile";

/**
 * Grid of generations, newest first. Generating, failed and canceled runs
 * stay visible until the user deletes them.
 */
export function Feed({
  runs,
  hydrated,
  empty,
}: {
  runs: Run[];
  hydrated: boolean;
  empty: { icon: LucideIcon; title: string; body: string };
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = runs.find((r) => r.id === openId) ?? null;

  if (!hydrated) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer aspect-square rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!runs.length) {
    const Icon = empty.icon;
    return (
      <div className="relative grid min-h-80 place-items-center overflow-hidden rounded-2xl border border-dashed border-border-strong p-10 text-center">
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative flex max-w-sm flex-col items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl border border-border-strong bg-surface-2">
            <Icon className="size-5 text-accent" />
          </div>
          <p className="font-medium">{empty.title}</p>
          <p className="text-sm text-muted">{empty.body}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="columns-1 gap-3 sm:columns-2 xl:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
        {runs.map((run) => (
          <RunTile key={run.id} run={run} onOpen={(r) => setOpenId(r.id)} />
        ))}
      </div>
      <RunDetail run={open} onClose={() => setOpenId(null)} />
    </>
  );
}
