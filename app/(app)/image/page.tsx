import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Image Studio" };

export default function Page() {
  return <WorkspacePlaceholder navKey="image" phase={3} />;
}
