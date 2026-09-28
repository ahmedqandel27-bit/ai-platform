import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/common/workspace-placeholder";

export const metadata: Metadata = { title: "Super Computer" };

export default function Page() {
  return <WorkspacePlaceholder navKey="superComputer" phase={5} />;
}
