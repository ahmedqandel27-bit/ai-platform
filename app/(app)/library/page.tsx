import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Library" };

export default function Page() {
  return <WorkspacePlaceholder navKey="library" phase={6} />;
}
