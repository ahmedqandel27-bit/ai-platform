import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Library as LibraryIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Library } from "@/components/studio/library";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const t = await getTranslations("pages.library");
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader icon={LibraryIcon} title={t("title")} description={t("description")} />
      <Library />
    </div>
  );
}
