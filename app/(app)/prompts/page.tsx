import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Prompts" };

export default function Page() {
  return <WorkspacePlaceholder navKey="prompts" phase={6} />;
}
