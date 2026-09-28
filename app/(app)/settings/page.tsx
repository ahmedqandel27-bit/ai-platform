import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <WorkspacePlaceholder navKey="settings" phase={6} />;
}
