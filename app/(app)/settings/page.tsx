import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const t = await getTranslations("pages.settings");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader icon={Settings} title={t("title")} description={t("description")} />
      <SettingsView />
    </div>
  );
}
