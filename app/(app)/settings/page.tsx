import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader navKey="settings" />
      <SettingsView />
    </div>
  );
}
