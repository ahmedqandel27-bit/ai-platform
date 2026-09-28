"use client";

import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Jobs tray — queued / running / done / failed generations with progress.
 * Phase 1: empty-state shell. Phase 2 wires it to the `jobs` table via TanStack Query.
 */
export function JobsTray() {
  const t = useTranslations("topbar");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Activity />
          <span className="hidden sm:inline">{t("jobs")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="grid size-10 place-items-center rounded-full bg-white/5">
            <Activity className="size-4 text-muted" />
          </div>
          <p className="text-sm font-medium">{t("noJobs")}</p>
          <p className="text-xs text-muted">{t("noJobsHint")}</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
