import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader navKey="projects" />
      <ProjectsView />
    </div>
  );
}
