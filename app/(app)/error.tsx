"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Any unexpected crash inside the workspace lands here instead of a blank page. */
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
      <span className="font-display text-6xl italic text-accent/80">!</span>
      <h1 className="font-display mt-4 text-4xl">{t("crashTitle")}</h1>
      <p className="mt-3 text-sm text-muted">{t("crashBody")}</p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-muted/60" dir="ltr">
          ref {error.digest}
        </p>
      )}
      <Button className="mt-8" onClick={reset}>
        <RotateCcw />
        {t("retry")}
      </Button>
    </div>
  );
}
