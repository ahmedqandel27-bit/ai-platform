import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/layout/logo";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { StudioVisual } from "@/components/brand/studio-visual";
import { Reveal } from "@/components/motion/reveal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const t = await getTranslations("brand");
  const pillars = ["superComputer", "video", "image"] as const;

  return (
    <div className="app-glow relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="absolute end-4 top-4 z-10">
        <LocaleToggle />
      </div>

      {/* Editorial side (desktop): point of view + what the studio makes. */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-e border-border p-12 lg:flex">
        <Logo />
        <div className="pointer-events-none absolute inset-x-12 top-[18%] bottom-[34%]">
          <StudioVisual />
        </div>
        <Reveal className="relative">
          <p className="eyebrow mb-5">{t("eyebrow")}</p>
          <h1 className="font-display max-w-xl text-6xl leading-[1.02]">
            {t("headlineA")} <em className="text-gradient">{t("headlineB")}</em>
          </h1>
          <ol className="mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-border pt-6">
            {pillars.map((key, i) => (
              <li key={key}>
                <span className="font-display block text-2xl italic text-accent" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-1 block text-sm">{t(`pillars.${key}`)}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Sign-in side. */}
      <section className="flex flex-col items-center justify-center px-5 py-16">
        <div className="mb-10 flex flex-col items-center gap-4 text-center lg:hidden">
          <Logo />
          <h1 className="font-display text-4xl leading-tight">
            {t("headlineA")} <em className="text-gradient">{t("headlineB")}</em>
          </h1>
        </div>
        <Suspense>
          <LoginForm configured={isSupabaseConfigured} />
        </Suspense>
        <p className="mt-8 text-center text-[11px] text-muted/70">{t("private")}</p>
      </section>
    </div>
  );
}
