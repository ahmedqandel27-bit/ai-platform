import { useTranslations } from "next-intl";
import { Database } from "lucide-react";

/** Shown in preview mode for features that need the database. */
export function RequiresSupabase() {
  const t = useTranslations("common");
  return (
    <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-border-strong p-10 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <Database className="size-6 text-muted" />
        <p className="font-medium">{t("needsSupabaseTitle")}</p>
        <p className="text-sm text-muted">{t("needsSupabaseBody")}</p>
      </div>
    </div>
  );
}
