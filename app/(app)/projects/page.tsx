import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return <WorkspacePlaceholder navKey="projects" phase={6} />;
}
