import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Image as ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Image Studio" };

export default async function ImageStudioPage() {
  const t = await getTranslations("pages.image");
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader icon={ImageIcon} title={t("title")} description={t("description")} />
      <Studio surface="image" />
    </div>
  );
}
