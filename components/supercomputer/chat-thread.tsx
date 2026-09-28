"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Cpu, TriangleAlert } from "lucide-react";
import type { Session } from "@/lib/supercomputer/store";
import { PlanCard } from "./plan-card";

export function ChatThread({ session, onSuggestion }: { session: Session; onSuggestion: (text: string) => void }) {
  const t = useTranslations("sc");
  const endRef = useRef<HTMLDivElement>(null);
  const count = session.messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count]);

  if (!count) {
    const suggestions = t.raw("suggestions") as string[];
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center">
        <div className="bg-gradient-accent grid size-14 place-items-center rounded-2xl shadow-[0_0_40px_-8px_rgb(139_92_246/0.8)]">
          <Cpu className="size-6 text-white" />
        </div>
        <h2 className="mt-5 text-xl font-semibold sm:text-2xl">{t("heroTitle")}</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">{t("heroBody")}</p>
        <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion(s)}
              className="rounded-xl border border-border bg-surface/60 p-3 text-start text-sm text-muted transition hover:border-accent/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
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
