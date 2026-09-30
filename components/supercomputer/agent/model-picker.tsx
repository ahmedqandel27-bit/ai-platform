"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronDown, Gauge, Sparkles } from "lucide-react";
import { EFFORTS, type AgentModelInfo } from "@/lib/agent/types";
import { useSuperComputer } from "@/lib/supercomputer/store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Thinking model + effort for the Super Computer (remembered per browser). */
export function ModelPicker({ models }: { models: AgentModelInfo[] }) {
  const t = useTranslations("agent");
  const { agentModel, agentEffort, setAgentPrefs } = useSuperComputer();
  const current = models.find((m) => m.id === agentModel) ?? models[0];
  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="sc-model"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <Sparkles className="size-3.5 text-accent" />
          <span className="max-w-32 truncate font-medium text-foreground/90" dir="ltr">
            {current.label}
          </span>
          {current.effort && <span className="hidden text-muted/80 sm:inline">· {t(`effortLevels.${agentEffort}`)}</span>}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-72">
        <DropdownMenuLabel>{t("model")}</DropdownMenuLabel>
        {models.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => setAgentPrefs({ model: m.id })} className="items-start">
            <Check className={cn("mt-0.5 shrink-0", m.id === current.id ? "!text-accent" : "opacity-0")} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-medium" dir="ltr">
                  {m.label}
                </span>
                {m.premium && <span className="rounded-full bg-accent/15 px-1.5 py-px text-[10px] text-accent">{t("premium")}</span>}
              </span>
              <span className="block truncate text-[11px] text-muted" dir="ltr">
                {m.blurb}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        {current.effort && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <Gauge className="size-3.5" />
              {t("effort")}
            </DropdownMenuLabel>
            <div className="grid grid-cols-4 gap-1 px-1.5 pb-1">
              {EFFORTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setAgentPrefs({ effort: e })}
                  className={cn(
                    "rounded-lg px-1 py-1.5 text-[11px] transition-colors",
                    e === agentEffort ? "bg-accent/20 text-foreground" : "text-muted hover:bg-white/5",
                  )}
                >
                  {t(`effortLevels.${e}`)}
                </button>
              ))}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
