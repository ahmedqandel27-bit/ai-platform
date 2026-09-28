import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Usage" };

export default function Page() {
  return <WorkspacePlaceholder navKey="usage" phase={6} />;
}
