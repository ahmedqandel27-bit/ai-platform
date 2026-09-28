import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const t = await getTranslations("pages.projects");
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader icon={FolderKanban} title={t("title")} description={t("description")} />
      <ProjectsView />
    </div>
  );
}
