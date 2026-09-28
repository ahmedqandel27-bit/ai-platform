"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { Button } from "@/components/ui/button";

/** Switches between Arabic (RTL) and English (LTR). */
export function useToggleLocale() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      await setLocale(locale === "ar" ? "en" : "ar");
      router.refresh();
    });

  return { toggle, pending };
}

export function LocaleToggle() {
  const t = useTranslations("topbar");
  const { toggle, pending } = useToggleLocale();

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending} className="gap-1.5">
      <Languages />
      <span className="hidden sm:inline">{t("language")}</span>
    </Button>
  );
}
