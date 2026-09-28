import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Video Studio" };

export default function VideoStudioPage() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader navKey="video" />
      <Studio surface="video" />
    </div>
  );
}
