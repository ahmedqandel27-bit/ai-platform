"use client";

import { useEffect } from "react";
import { stopWatching } from "@/generation/poll";
import { bootstrapRuns, teardownRuns } from "@/lib/studio/runs-controller";

/** Loads generation history once per app mount and resumes polling. */
export function RunsBootstrap() {
  useEffect(() => {
    void bootstrapRuns();
    return () => {
      teardownRuns();
      stopWatching();
    };
  }, []);
  return null;
}
