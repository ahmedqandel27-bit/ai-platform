import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Image Studio" };

export default function ImageStudioPage() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader navKey="image" />
      <Studio surface="image" />
    </div>
  );
}
