import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { PromptLibrary } from "@/components/prompts/prompt-library";

export const metadata: Metadata = { title: "Prompts" };

export default function PromptsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader navKey="prompts" />
      <PromptLibrary />
    </div>
  );
}
