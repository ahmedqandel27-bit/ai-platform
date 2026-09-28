import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookText } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PromptLibrary } from "@/components/prompts/prompt-library";

export const metadata: Metadata = { title: "Prompts" };

export default async function PromptsPage() {
  const t = await getTranslations("pages.prompts");
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader icon={BookText} title={t("title")} description={t("description")} />
      <PromptLibrary />
    </div>
  );
}
