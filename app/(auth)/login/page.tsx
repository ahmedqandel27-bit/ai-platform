import type { Metadata } from "next";
import { Suspense } from "react";
import { APP_TAGLINE } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/layout/logo";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="app-glow relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute end-4 top-4">
        <LocaleToggle />
      </div>
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo />
        <p className="text-gradient text-sm font-medium" dir="ltr">
          {APP_TAGLINE}
        </p>
      </div>
      <Suspense>
        <LoginForm configured={isSupabaseConfigured} />
      </Suspense>
    </div>
  );
}
