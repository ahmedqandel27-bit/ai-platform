import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Video Studio" };

export default function Page() {
  return <WorkspacePlaceholder navKey="video" phase={4} />;
}
