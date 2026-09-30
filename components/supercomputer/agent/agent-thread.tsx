"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Brain, BookmarkCheck, Clapperboard, Cpu, Film, HelpCircle, ImageIcon, Loader2, Play, Square, TriangleAlert } from "lucide-react";
import { modelLabel } from "@/lib/supercomputer/plan";
import { resumeAgent, stopAgent } from "@/lib/agent/runner";
import type { ToolCall, TranscriptUpload } from "@/lib/agent/types";
import type { AgentAsset, AgentState, Session } from "@/lib/supercomputer/store";
import { cn } from "@/lib/utils";

/** The agent chat: what it said, what it thought, and every generation as it happens. */
export function AgentThread({ session, agent, onAnswer }: { session: Session; agent: AgentState; onAnswer: (text: string) => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  const size = agent.transcript.length + Object.keys(agent.calls).length + agent.assets.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [size, agent.status]);

  const assets = new Map(agent.assets.map((a) => [a.id, a]));
  const lastIndex = agent.transcript.length - 1;

  return (
    <div className="flex-1 space-y-6 py-4" data-testid="sc-thread" key={session.id}>
      {agent.transcript.map((turn, index) => {
        if (turn.role === "user")
          return (
            <div key={index} className="space-y-2">
              <UserBubble text={turn.text} uploads={turn.uploads} />
              {turn.brief && <DirectorBrief text={turn.brief} />}
            </div>
          );
        if (turn.role === "tool") return turn.answer ? <UserBubble key={index} text={turn.answer.text} uploads={turn.answer.uploads} /> : null;
        return (
          <div key={index} className="flex gap-3" data-testid="sc-assistant">
            <Avatar />
            <div className="min-w-0 flex-1 space-y-3">
              {turn.thinking && <Thinking text={turn.thinking} />}
              {turn.text && (
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed">
                  {turn.text}
                </p>
              )}
              {turn.assetIds && turn.assetIds.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {turn.assetIds.map((id) => assets.get(id)).filter((a): a is AgentAsset => Boolean(a)).map((a) => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border border-border bg-black">
                      {a.kind === "video" ? (
                        <video src={a.url} controls playsInline preload="metadata" className="max-h-[420px] w-full" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- generated output
                        <img src={a.url} alt={a.id} className="max-h-[420px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]" />
                      )}
                      <span className="absolute start-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur" dir="ltr">
                        {a.id}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {turn.calls.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {turn.calls.map((call) => (
                    <CallCard
                      key={call.id}
                      call={call}
                      agent={agent}
                      assets={assets}
                      canAnswer={index === lastIndex && agent.status === "waiting"}
                      onAnswer={onAnswer}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <StatusBar sessionId={session.id} agent={agent} />
      <div ref={endRef} />
    </div>
  );
}

function Avatar() {
  return (
    <div className="bg-gradient-accent mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg">
      <Cpu className="size-4 text-white" />
    </div>
  );
}

function UserBubble({ text, uploads }: { text: string; uploads: TranscriptUpload[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-accent/15 px-4 py-2.5">
        {uploads.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {uploads.map((u) =>
              u.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded thumbnail
                <img key={u.id} src={u.url} alt={u.id} className="size-16 rounded-lg object-cover" />
              ) : (
                <span key={u.id} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-muted">
                  {u.id} · {u.kind}
                </span>
              ),
            )}
          </div>
        )}
        {text && (
          <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}

function DirectorBrief({ text }: { text: string }) {
  const t = useTranslations("agent");
  return (
    <details className="ms-auto max-w-[85%] rounded-xl border border-accent/25 bg-accent/[0.05] px-3 py-2 text-xs text-muted">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-accent marker:hidden">
        <Clapperboard className="size-3.5" />
        {t("directorBrief")}
      </summary>
      <p dir="ltr" className="mt-2 whitespace-pre-wrap text-start leading-relaxed">
        {text}
      </p>
    </details>
  );
}

function Thinking({ text }: { text: string }) {
  const t = useTranslations("agent");
  return (
    <details className="group rounded-xl border border-border bg-white/[0.02] px-3 py-2 text-xs text-muted">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 marker:hidden">
        <Brain className="size-3.5" />
        {t("thoughtProcess")}
      </summary>
      <p dir="auto" className="mt-2 whitespace-pre-wrap leading-relaxed">
        {text}
      </p>
    </details>
  );
}

function aspectOf(input: Record<string, unknown>): string {
  const settings = input.settings as Record<string, unknown> | undefined;
  const ratio = typeof settings?.aspectRatio === "string" ? settings.aspectRatio : "";
  const m = /^(\d+):(\d+)$/.exec(ratio);
  return m ? `${m[1]} / ${m[2]}` : "1 / 1";
}

function CallCard({
  call,
  agent,
  assets,
  canAnswer,
  onAnswer,
}: {
  call: ToolCall;
  agent: AgentState;
  assets: Map<string, AgentAsset>;
  canAnswer: boolean;
  onAnswer: (text: string) => void;
}) {
  const t = useTranslations("agent");
  const state = agent.calls[call.id];
  const input = call.input;

  if (call.name === "remember" && !call.invalid) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted sm:col-span-2 sm:w-fit">
        <BookmarkCheck className="size-3.5 text-accent" />
        {t("remembered")}: <span dir="auto" className="text-foreground/90">{String(input.fact ?? "")}</span>
      </p>
    );
  }

  if (call.name === "ask_user" && !call.invalid) {
    const options = Array.isArray(input.options) ? (input.options as string[]) : [];
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-3.5 sm:col-span-2">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] text-accent">
          <HelpCircle className="size-3.5" />
          {t("question")}
        </p>
        <p dir="auto" className="whitespace-pre-wrap text-sm">
          {String(input.question ?? "")}
        </p>
        {options.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                disabled={!canAnswer}
                onClick={() => onAnswer(o)}
                dir="auto"
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs transition-colors enabled:hover:border-accent/60 enabled:hover:bg-accent/10 disabled:opacity-50"
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const video = call.name === "generate_video";
  const Icon = video ? Film : ImageIcon;
  const outputs = (state?.assetIds ?? []).map((id) => assets.get(id)).filter((a): a is AgentAsset => Boolean(a));
  const model = outputs[0]?.model ?? (typeof input.model === "string" && input.model !== "auto" ? input.model : "");
  const status = state?.status ?? (agent.status === "working" ? "running" : undefined);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className="size-3.5 shrink-0 text-accent" />
        <span dir="auto" className="min-w-0 flex-1 truncate text-xs font-medium">
          {typeof input.title === "string" && input.title ? input.title : t(video ? "video" : "image")}
        </span>
        {model && (
          <span className="shrink-0 text-[10px] text-muted" dir="ltr">
            {modelLabel(model)}
          </span>
        )}
      </div>

      {status === "done" && outputs.length > 0 ? (
        <div className={cn("grid gap-px bg-border", outputs.length > 1 && "grid-cols-2")}>
          {outputs.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="group relative block bg-black">
              {a.kind === "video" ? (
                <video src={a.url} controls playsInline preload="metadata" className="max-h-[480px] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- generated output
                <img src={a.url} alt={a.id} className="max-h-[480px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]" />
              )}
              <span className="absolute start-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur" dir="ltr">
                {a.id}
              </span>
            </a>
          ))}
        </div>
      ) : status === "running" ? (
        <div className="shimmer grid w-full place-items-center" style={{ aspectRatio: aspectOf(input), maxHeight: 320 }}>
          <Loader2 className="size-5 animate-spin text-muted" />
        </div>
      ) : status === "failed" || call.invalid ? (
        <p className="flex items-start gap-1.5 px-3 pb-3 text-xs text-danger">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span dir="auto">{state?.error?.startsWith("{") ? t("failed") : (state?.error ?? t("failed"))}</span>
        </p>
      ) : status === "stopped" ? (
        <p className="px-3 pb-3 text-xs text-muted">{t("stoppedCall")}</p>
      ) : null}

      <details className="border-t border-border px-3 py-2 text-[11px] text-muted">
        <summary className="cursor-pointer list-none">{t("prompt")}</summary>
        <p className="mt-1.5 whitespace-pre-wrap leading-relaxed" dir="ltr">
          {String(input.prompt ?? "")}
        </p>
      </details>
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

function StatusBar({ sessionId, agent }: { sessionId: string; agent: AgentState }) {
  const t = useTranslations("agent");
  const active = agent.status === "thinking" || agent.status === "working";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const elapsed = agent.runStartedAt ? (agent.runEndedAt ?? now) - agent.runStartedAt : 0;
  const running = Object.values(agent.calls).filter((c) => c.status === "running").length;

  if (active) {
    const live = agent.hf?.live?.trim();
    return (
      <div className="space-y-2 ps-11">
      {live && (
        <p dir="auto" className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {live.slice(-600)}
        </p>
      )}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          {agent.status === "thinking" ? t("thinking") : t("working", { count: running || 1 })}
          <span className="tabular-nums text-muted/70" dir="ltr">
            {formatDuration(elapsed)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void stopAgent(sessionId)}
          data-testid="sc-stop"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-danger/50 hover:text-danger"
        >
          <Square className="size-3" />
          {t("stop")}
        </button>
      </div>
      </div>
    );
  }

  if (agent.status === "stopped" || agent.status === "error") {
    return (
      <div className="ms-11 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white/[0.02] px-3 py-2.5">
        {agent.status === "error" && <TriangleAlert className="size-4 shrink-0 text-danger" />}
        <p dir="auto" className={cn("min-w-0 flex-1 text-sm", agent.status === "error" ? "text-danger" : "text-muted")}>
          {agent.error ?? t("stopped")}
        </p>
        <button
          type="button"
          onClick={() => resumeAgent(sessionId)}
          className="bg-gradient-accent inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white"
        >
          <Play className="size-3" />
          {t("continue")}
        </button>
      </div>
    );
  }

  if (agent.status === "waiting") return <p className="ps-11 text-xs text-accent">{t("waiting")}</p>;

  if (agent.status === "done" && agent.runStartedAt)
    return (
      <p className="ps-11 text-[11px] text-muted/80">
        {agent.generations
          ? t("done", { time: formatDuration(elapsed), count: agent.generations })
          : t("doneShort", { time: formatDuration(elapsed) })}
      </p>
    );

  return null;
}
