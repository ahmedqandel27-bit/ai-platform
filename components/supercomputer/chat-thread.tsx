"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpLeft, Cpu, TriangleAlert } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import type { Session } from "@/lib/supercomputer/store";
import { PlanCard } from "./plan-card";

export function ChatThread({
  session,
  onSuggestion,
  heroBody,
}: {
  session: Session;
  onSuggestion: (text: string) => void;
  /** Replaces the default intro line (the agent describes itself differently). */
  heroBody?: string;
}) {
  const t = useTranslations("sc");
  const endRef = useRef<HTMLDivElement>(null);
  const count = session.messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count]);

  if (!count) {
    const suggestions = t.raw("suggestions") as string[];
    return (
      <div className="flex flex-1 flex-col justify-center py-8 lg:py-14">
        <Reveal>
          <div className="mb-6 flex items-center gap-3">
            <span className="font-display text-sm italic text-accent" dir="ltr">
              01
            </span>
            <span className="eyebrow">{t("heroEyebrow")}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-border-strong to-transparent rtl:bg-gradient-to-l" />
          </div>
          <h1 className="font-display max-w-3xl text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
            {t("heroTitleA")} <em className="text-gradient">{t("heroTitleB")}</em>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{heroBody ?? t("heroBody")}</p>
        </Reveal>

        <p className="eyebrow mb-3 mt-12">{t("tryOne")}</p>
        <Stagger className="grid border-t border-border sm:grid-cols-2" gap={0.07}>
          {suggestions.map((s, i) => (
            <StaggerItem key={s}>
              <button
                type="button"
                onClick={() => onSuggestion(s)}
                className="group flex w-full items-start gap-5 border-b border-border py-5 text-start transition-colors sm:odd:pe-6 sm:even:ps-6"
              >
                <span className="font-display w-8 shrink-0 text-2xl italic text-accent/80 transition-colors group-hover:text-accent" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 pt-1 text-[15px] leading-snug text-muted transition-colors group-hover:text-foreground" dir="auto">
                  {s}
                </span>
                <ArrowUpLeft className="mt-1.5 size-4 shrink-0 text-muted/0 transition-all group-hover:text-muted ltr:-scale-x-100" />
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 py-4" data-testid="sc-thread">
      {session.messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-accent/15 px-4 py-2.5">
              {m.uploads && m.uploads.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {m.uploads.map((u) =>
                    u.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- uploaded thumbnail
                      <img key={u.url} src={u.url} alt={u.name ?? ""} className="size-16 rounded-lg object-cover" />
                    ) : (
                      <span key={u.url} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-muted">
                        {u.name ?? u.kind}
                      </span>
                    ),
                  )}
                </div>
              )}
              {m.text && (
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.text}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex gap-3" data-testid="sc-assistant">
            <div className="bg-gradient-accent mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg">
              <Cpu className="size-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              {m.pending ? (
                <div className="shimmer inline-flex h-9 items-center rounded-xl px-4 text-sm text-muted">{t("planning")}</div>
              ) : m.error ? (
                <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {m.error}
                </p>
              ) : (
                m.text && (
                  <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed">
                    {m.text}
                  </p>
                )
              )}
              {m.plan && <PlanCard sessionId={session.id} messageId={m.id} plan={m.plan} />}
            </div>
          </div>
        ),
      )}
      <div ref={endRef} />
    </div>
  );
}
