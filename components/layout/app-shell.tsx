import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { getTeamContext } from "@/lib/team/server";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { KeyDialog } from "@/components/studio/key-dialog";
import { RunsBootstrap } from "@/components/studio/runs-bootstrap";

/** Authenticated app chrome: sidebar + topbar + palette around page content. */
export async function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  const t = await getTranslations("preview");
  const tb = await getTranslations("budget");
  const team = email ? await getTeamContext() : null;
  const budget = team?.team.monthlyBudget ?? null;
  const ratio = team && budget ? team.spend.monthSpent / budget : 0;

  return (
    <div className="app-glow flex min-h-dvh">
      <Sidebar />
      <MobileNav />
      <CommandPalette />
      <KeyDialog />
      <RunsBootstrap />
      <div className="flex min-w-0 flex-1 flex-col">
        {!isSupabaseConfigured && (
          <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning sm:px-6">
            <TriangleAlert className="size-3.5 shrink-0" />
            <span>{t("banner")}</span>
          </div>
        )}
        {ratio >= 0.8 && (
          <Link
            href="/usage"
            className={
              "flex items-center gap-2 border-b px-4 py-2 text-xs sm:px-6 " +
              (ratio >= 1 ? "border-danger/25 bg-danger/10 text-danger" : "border-warning/20 bg-warning/10 text-warning")
            }
          >
            <TriangleAlert className="size-3.5 shrink-0" />
            <span>{ratio >= 1 ? tb("reached") : tb("near", { percent: Math.round(ratio * 100) })}</span>
          </Link>
        )}
        <Topbar email={email} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
