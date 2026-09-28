import { getTranslations } from "next-intl/server";
import { NAV_ITEMS, type NavKey } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "./page-header";

/**
 * Temporary page body used until each workspace is implemented.
 * `phase` refers to the build plan in README.md.
 */
export async function WorkspacePlaceholder({ navKey, phase }: { navKey: NavKey; phase: number }) {
  const t = await getTranslations();
  const item = NAV_ITEMS.find((i) => i.key === navKey)!;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={item.icon}
        title={t(`pages.${navKey}.title`)}
        description={t(`pages.${navKey}.description`)}
      />
      <Card className="relative overflow-hidden p-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer aspect-video rounded-xl" />
          ))}
        </div>
        <div className="absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Badge variant="accent">{t("placeholder.comingIn", { phase })}</Badge>
            <p className="max-w-sm text-sm text-muted">{t("placeholder.body")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
