import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { UsageView } from "@/components/usage/usage-view";

export const metadata: Metadata = { title: "Usage" };

export default function UsagePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader navKey="usage" />
      <UsageView />
    </div>
  );
}
