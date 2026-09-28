import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/logo";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="app-glow flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="font-display mt-14 text-[120px] italic leading-none text-accent/80" dir="ltr">
        404
      </p>
      <h1 className="font-display mt-4 text-4xl">{t("notFoundTitle")}</h1>
      <p className="mt-3 max-w-sm text-sm text-muted">{t("notFoundBody")}</p>
      <Link href="/" className="mt-8 text-sm text-accent underline-offset-4 hover:underline">
        {t("home")}
      </Link>
    </div>
  );
}
