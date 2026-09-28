import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Library } from "@/components/studio/library";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader navKey="library" />
      <Library />
    </div>
  );
}
