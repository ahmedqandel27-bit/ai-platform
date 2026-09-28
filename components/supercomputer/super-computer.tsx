"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { getAssistantStatus } from "@/lib/supercomputer/actions";
import { sendMessage } from "@/lib/supercomputer/chat";
import { resumeRunningSteps } from "@/lib/supercomputer/runner";
import { useSuperComputer } from "@/lib/supercomputer/store";
import { ChatInput } from "./chat-input";
import { ChatThread } from "./chat-thread";
import { SidePanel } from "./side-panel";

/** The Super Computer workspace: chat → editable plan → Run all. */
export function SuperComputer() {
  const t = useTranslations("sc");
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const { sessions, activeId } = useSuperComputer();
  const session = sessions.find((s) => s.id === activeId);
  const busy = Boolean(session?.messages.some((m) => m.pending));
  const { data: status } = useQuery({ queryKey: ["assistant-status"], queryFn: () => getAssistantStatus(), staleTime: 5 * 60_000 });

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useSuperComputer.persist.rehydrate()).then(() => {
      if (cancelled) return;
      const state = useSuperComputer.getState();
      // A planner call cut off by a reload never resolves: clear its placeholder.
      for (const s of state.sessions)
        for (const m of s.messages) if (m.pending) state.patchMessage(s.id, m.id, { pending: false, error: "Interrupted. Send it again." });
      if (!state.sessions.some((s) => s.id === state.activeId)) state.newSession();
      resumeRunningSteps();
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !session) {
    return <div className="shimmer h-[60vh] rounded-2xl" />;
  }

  const onSend = (text: string, uploads: Parameters<typeof sendMessage>[2]) => {
    setDraft("");
    void sendMessage(session.id, text, uploads);
  };

  const plannerLabel =
    status?.provider === "anthropic"
      ? t("plannerClaude")
      : status?.provider === "openai-compatible"
        ? t("plannerCompat")
        : status
          ? t("plannerBuiltin")
          : "";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-[calc(100dvh-13rem)] min-w-0 flex-col">
        <ChatThread session={session} onSuggestion={(s) => setDraft(s)} />
        <div className="sticky bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent pb-2 pt-4">
          <ChatInput value={draft} onChange={setDraft} onSend={onSend} busy={busy} />
          {plannerLabel && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted/80">
              <Sparkles className="size-3" />
              {plannerLabel}
            </p>
          )}
        </div>
      </div>
      <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
        <SidePanel session={session} />
      </div>
    </div>
  );
}
