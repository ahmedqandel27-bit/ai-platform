import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Clapperboard } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Video Studio" };

export default async function VideoStudioPage() {
  const t = await getTranslations("pages.video");
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader icon={Clapperboard} title={t("title")} description={t("description")} />
      <Studio surface="video" />
    </div>
  );
}
