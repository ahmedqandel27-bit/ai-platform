import { getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

/** Authenticated app chrome: sidebar + topbar + palette around page content. */
export async function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  const t = await getTranslations("preview");

  return (
    <div className="app-glow flex min-h-dvh">
      <Sidebar />
      <MobileNav />
      <CommandPalette />
      <div className="flex min-w-0 flex-1 flex-col">
        {!isSupabaseConfigured && (
          <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning sm:px-6">
            <TriangleAlert className="size-3.5 shrink-0" />
            <span>{t("banner")}</span>
          </div>
        )}
        <Topbar email={email} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
