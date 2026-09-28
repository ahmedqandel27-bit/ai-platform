import type { Metadata } from "next";
import { ProjectDetail } from "@/components/projects/project-detail";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-[1600px]">
      <ProjectDetail id={id} />
    </div>
  );
}
