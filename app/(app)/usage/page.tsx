import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Gauge } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { UsageView } from "@/components/usage/usage-view";

export const metadata: Metadata = { title: "Usage" };

export default async function UsagePage() {
  const t = await getTranslations("pages.usage");
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader icon={Gauge} title={t("title")} description={t("description")} />
      <UsageView />
    </div>
  );
}
