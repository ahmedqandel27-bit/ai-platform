"use client";

import { useTranslations } from "next-intl";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ email }: { email: string | null }) {
  const t = useTranslations("topbar");
  const initial = (email?.[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="bg-gradient-accent grid size-8 place-items-center rounded-full text-xs font-semibold text-white ring-2 ring-white/10 transition hover:ring-white/25"
          aria-label={t("account")}
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex items-center gap-2">
          <User className="size-3.5" />
          <span className="truncate" dir="ltr">{email ?? "preview@local"}</span>
        </DropdownMenuLabel>
        {email && (
          <>
            <DropdownMenuSeparator />
            {/* Plain form POST so sign-out works without client JS. */}
            <form action="/auth/signout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  {t("signOut")}
                </button>
              </DropdownMenuItem>
            </form>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
