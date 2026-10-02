"use client"

import { getModel } from "@/generation/catalog"
import { APP_NAME } from "@/lib/config"
import { inferInputMode } from "@/generation/catalog/media-inputs"
import type { MediaItem, MediaRole } from "@/generation/catalog/types"
import { isTerminal, type Run } from "@/generation/run-types"
import { useRunsStore } from "@/generation/stores/runs"
import { cancelRun, submitRun } from "@/lib/studio/runs-controller"
import { normalizePlan, surfaceOf, type Ref, type UploadInfo } from "@/lib/supercomputer/plan"
import { waitForRun } from "@/lib/supercomputer/runner"
import { emptyAgent, useSuperComputer, type AgentAsset, type AgentState } from "@/lib/supercomputer/store"
import { agentTurn, writeDirectorBrief } from "./actions"
import { hfAgentInterrupt, hfAgentPoll, hfAgentSend, hfAgentStart } from "./higgsfield"
import { MAX_GENERATIONS_PER_RUN, MAX_PARALLEL_GENERATIONS, MAX_TURNS_PER_RUN } from "./limits"
import type { AskUserInput, GenerateImageInput, GenerateVideoInput } from "./tools"
import { HF_AGENT_ID, type AgentTurn, type ToolCall, type ToolResult, type TranscriptUpload } from "./types"

/**
 * The agent loop, driven from the browser: ask the model for its next move →
 * run the generations it asked for (through the studios' submit → poll path,
 * so they land in the jobs tray and the library) → hand the results back
 * (images included, so it can review them) → repeat until it is done, asks
 * the user something, hits a limit or is stopped.
 */

const driving = new Set<string>()
const stopping = new Set<string>()
/** Errors that no retry by the model can fix. */
const FATAL = new Set(["missing_key", "invalid_key", "insufficient_credits", "unauthenticated"])

const sc = () => useSuperComputer.getState()
const agentOf = (sessionId: string): AgentState | undefined => sc().sessions.find((s) => s.id === sessionId)?.agent
const patch = (sessionId: string, fn: (a: AgentState) => AgentState) => sc().patchAgent(sessionId, fn)

/** "[Studio memory]" block for the model, or undefined when this chat already has the current version. */
function memoryContext(agent: AgentState): { context?: string; sent?: string } {
  const memory = sc().memory
  const joined = memory.join("\n")
  if (!memory.length || joined === agent.memorySent) return {}
  return { context: `[Studio memory]\n${memory.map((m) => `- ${m}`).join("\n")}`, sent: joined }
}

export function isDriving(sessionId: string) {
  return driving.has(sessionId)
}

function nextAssetId(agent: AgentState, prefix: "u" | "a"): string {
  const used = agent.assets.filter((a) => a.id.startsWith(prefix)).map((a) => Number(a.id.slice(1)) || 0)
  return `${prefix}${Math.max(0, ...used) + 1}`
}

/** Registers the user's attachments as "u<n>" assets. */
function addUploads(sessionId: string, uploads: Array<{ url: string; kind: AgentAsset["kind"]; name?: string }>): TranscriptUpload[] {
  const added: TranscriptUpload[] = []
  patch(sessionId, (a) => {
    const assets = [...a.assets]
    for (const u of uploads) {
      const id = nextAssetId({ ...a, assets }, "u")
      assets.push({ id, kind: u.kind, url: u.url, source: "upload", ...(u.name ? { title: u.name } : {}) })
      added.push({ id, url: u.url, kind: u.kind })
    }
    return { ...a, assets }
  })
  return added
}

/** A new message from the user: starts (or, after an ask_user, continues) a run. */
export async function sendToAgent(
  sessionId: string,
  text: string,
  uploads: Array<{ url: string; kind: AgentAsset["kind"]; name?: string }>,
) {
  if (sc().agentModel === HF_AGENT_ID) return sendToHiggsfield(sessionId, text, uploads)
  const agent = agentOf(sessionId) ?? emptyAgent()
  const files = addUploads(sessionId, uploads)
  const last = agent.transcript[agent.transcript.length - 1]
  const ask = last?.role === "assistant" ? last.calls.find((c) => c.name === "ask_user") : undefined

  useSuperComputer.setState((state) => ({
    sessions: state.sessions.map((s) => (s.id === sessionId && !s.title ? { ...s, title: text.trim().slice(0, 60) } : s)),
  }))

  patch(sessionId, (a) => {
    const base = { ...a, status: "thinking" as const, error: undefined, runStartedAt: Date.now(), runEndedAt: undefined, generations: 0, turns: 0 }
    if (ask && a.status === "waiting") {
      // The answer closes the pending question: it goes back as that tool's result.
      const answer: ToolResult = {
        id: ask.id,
        ok: true,
        text: `The user answered: ${text.trim() || "(no text)"}${files.length ? ` — and attached ${files.map((f) => `${f.id} (${f.kind})`).join(", ")}` : ""}`,
        ...(files.some((f) => f.kind === "image") ? { images: files.filter((f) => f.kind === "image").map((f) => f.url) } : {}),
      }
      return {
        ...base,
        pending: undefined,
        calls: { ...a.calls, [ask.id]: { status: "done" } },
        transcript: [...a.transcript, { role: "tool", results: [...(a.pending ?? []), answer], answer: { text: text.trim(), uploads: files } }],
      }
    }
    const mem = memoryContext(a)
    return {
      ...base,
      ...(mem.sent !== undefined ? { memorySent: mem.sent } : {}),
      transcript: [...a.transcript, { role: "user", text: text.trim(), uploads: files, ...(mem.context ? { context: mem.context } : {}) }],
    }
  })
  await drive(sessionId)
}

/** Stop button: no new steps; generations still queued on Higgsfield are canceled. */
export async function stopAgent(sessionId: string) {
  stopping.add(sessionId)
  const agent = agentOf(sessionId)
  if (!agent) return
  if (agent.hf) {
    // The poll loop notices the flag; interrupt here too in case it is between polls.
    await hfAgentInterrupt({ sessionId: agent.hf.sessionId })
    if (!driving.has(sessionId)) {
      stopping.delete(sessionId)
      patch(sessionId, (a) => ({ ...a, status: "stopped", runEndedAt: Date.now() }))
    }
    return
  }
  const runs = useRunsStore.getState().runs
  const live = Object.values(agent.calls)
    .filter((c) => c.status === "running" && c.runId)
    .map((c) => runs.find((r) => r.id === c.runId))
    .filter((r): r is Run => Boolean(r?.requestId) && !isTerminal(r!.status))
  await Promise.all(live.map((r) => cancelRun(r)))
  if (!driving.has(sessionId)) {
    stopping.delete(sessionId)
    patch(sessionId, (a) => ({ ...a, status: "stopped", runEndedAt: Date.now() }))
  }
}

/** Continue after a stop, an error or a reload. */
export function resumeAgent(sessionId: string) {
  const agent = agentOf(sessionId)
  if (agent?.hf && sc().agentModel === HF_AGENT_ID) {
    // Higgsfield's turn already ended (stopped or failed): ask it to pick up again.
    void sendToHiggsfield(sessionId, "Continue where you left off.", [])
    return
  }
  patch(sessionId, (a) => ({ ...a, status: "thinking", error: undefined, runEndedAt: undefined, runStartedAt: a.runStartedAt ?? Date.now() }))
  void drive(sessionId)
}

/** After a reload: runs that were generating pick up their in-flight jobs; a model call cut off mid-way waits for Continue. */
export function resumeAgentsAfterReload() {
  for (const session of sc().sessions) {
    const status = session.agent?.status
    if (session.agent?.hf?.cursor && (status === "working" || status === "thinking")) void pollHiggsfield(session.id)
    else if (status === "working") void drive(session.id)
    else if (status === "thinking")
      patch(session.id, (a) => ({ ...a, status: "stopped", error: "Interrupted by a page reload. Press Continue to pick up where it left off." }))
  }
}

async function drive(sessionId: string) {
  if (driving.has(sessionId)) return
  driving.add(sessionId)
  stopping.delete(sessionId)
  try {
    for (;;) {
      const agent = agentOf(sessionId)
      if (!agent) return
      if (stopping.has(sessionId)) {
        patch(sessionId, (a) => ({ ...a, status: "stopped", runEndedAt: Date.now() }))
        return
      }
      const last = agent.transcript[agent.transcript.length - 1]
      if (!last) return

      if (last.role === "assistant") {
        if (!last.calls.length) {
          patch(sessionId, (a) => ({ ...a, status: "done", runEndedAt: Date.now() }))
          return
        }
        const ask = last.calls.find((c) => c.name === "ask_user" && !c.invalid)
        const work = last.calls.filter((c) => c !== ask)
        patch(sessionId, (a) => ({ ...a, status: "working" }))
        const results = await executeCalls(sessionId, work)
        if (results.fatal) {
          patch(sessionId, (a) => ({
            ...a,
            status: "error",
            error: results.fatal,
            runEndedAt: Date.now(),
            transcript: [...a.transcript, { role: "tool", results: withAskClosed(results.results, ask, "Not asked: the run stopped on an error.") }],
          }))
          return
        }
        if (ask && !stopping.has(sessionId)) {
          patch(sessionId, (a) => ({
            ...a,
            status: "waiting",
            pending: results.results,
            calls: { ...a.calls, [ask.id]: { status: "running" } },
            runEndedAt: Date.now(),
          }))
          return
        }
        patch(sessionId, (a) => ({
          ...a,
          transcript: [...a.transcript, { role: "tool", results: withAskClosed(results.results, ask, "Not asked: the user stopped the run.") }],
        }))
        continue
      }

      // Last turn is the user's or tool results → the model's move.
      if (agent.turns >= MAX_TURNS_PER_RUN) {
        patch(sessionId, (a) => ({ ...a, status: "stopped", runEndedAt: Date.now(), error: `Paused after ${MAX_TURNS_PER_RUN} steps. Press Continue to keep going.`, turns: 0 }))
        return
      }
      patch(sessionId, (a) => ({ ...a, status: "thinking", turns: a.turns + 1 }))
      const { agentModel, agentEffort } = sc()
      let response: Awaited<ReturnType<typeof agentTurn>>
      try {
        response = await agentTurn({ model: agentModel ?? "", effort: agentEffort, transcript: agent.transcript })
      } catch {
        response = { ok: false, error: { code: "network", message: "Connection lost. Press Continue to retry." } }
      }
      // Stopped while the model was thinking: its answer is dropped (nothing was appended yet).
      if (stopping.has(sessionId)) continue
      if (!response.ok) {
        patch(sessionId, (a) => ({ ...a, status: "error", error: response.ok ? undefined : response.error.message, runEndedAt: Date.now() }))
        return
      }
      const { text, thinking, calls, raw, model } = response.data
      const turn: AgentTurn = { role: "assistant", text, calls, model, ...(thinking ? { thinking } : {}), ...(raw ? { raw } : {}) }
      patch(sessionId, (a) => ({ ...a, transcript: [...a.transcript, turn] }))
    }
  } finally {
    driving.delete(sessionId)
    stopping.delete(sessionId)
  }
}

function withAskClosed(results: ToolResult[], ask: ToolCall | undefined, reason: string): ToolResult[] {
  return ask ? [...results, { id: ask.id, ok: false, text: reason }] : results
}

/* ─── Tool execution ───────────────────────────────────────────────────── */

async function executeCalls(sessionId: string, calls: ToolCall[]): Promise<{ results: ToolResult[]; fatal?: string }> {
  let fatal: string | undefined
  const queue = [...calls]
  const results = new Map<string, ToolResult>()
  const worker = async () => {
    for (let call = queue.shift(); call; call = queue.shift()) {
      const result = await executeCall(sessionId, call).catch(
        (caught): { result: ToolResult; fatal?: string } => ({
          result: { id: call!.id, ok: false, text: caught instanceof Error ? caught.message : String(caught) },
        }),
      )
      results.set(call.id, result.result)
      if (result.fatal) fatal ??= result.fatal
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_GENERATIONS, calls.length) }, worker))
  return { results: calls.map((c) => results.get(c.id)!), ...(fatal ? { fatal } : {}) }
}

async function executeCall(sessionId: string, call: ToolCall): Promise<{ result: ToolResult; fatal?: string }> {
  const fail = (text: string): { result: ToolResult } => {
    patch(sessionId, (a) => ({ ...a, calls: { ...a.calls, [call.id]: { status: "failed", error: text } } }))
    return { result: { id: call.id, ok: false, text } }
  }
  if (call.invalid) return fail(JSON.stringify({ INVALID_JSON: call.invalid }))
  if (call.name === "remember") {
    const fact = String(call.input.fact ?? "").trim()
    sc().addMemory(fact)
    // The chat now knows this fact: don't resend it as new memory.
    patch(sessionId, (a) => ({ ...a, memorySent: sc().memory.join("\n"), calls: { ...a.calls, [call.id]: { status: "done" } } }))
    return { result: { id: call.id, ok: true, text: "Saved to the studio memory." } }
  }
  if (stopping.has(sessionId)) return { result: stoppedResult(sessionId, call) }

  const agent = agentOf(sessionId)!
  const state = agent.calls[call.id]
  if (state?.status === "done" || state?.status === "failed") return { result: resultFromState(agent, call) }

  // Re-adopt a generation already submitted before a reload; never submit twice.
  let runId = state?.runId
  if (!runId) {
    if (agent.generations >= MAX_GENERATIONS_PER_RUN)
      return fail(`The generation budget for this run (${MAX_GENERATIONS_PER_RUN}) is used up. Wrap up with what you have and tell the user.`)
    const prepared = prepare(agent, call)
    if ("error" in prepared) return fail(prepared.error)
    patch(sessionId, (a) => ({ ...a, generations: a.generations + 1, calls: { ...a.calls, [call.id]: { status: "running" } } }))
    const run = await submitRun(prepared.submit)
    if (run.status === "error") {
      const message = run.error?.message ?? "Could not submit the generation."
      const out = fail(message)
      return FATAL.has(run.error?.code ?? "") ? { ...out, fatal: message } : out
    }
    runId = run.id
    patch(sessionId, (a) => ({ ...a, calls: { ...a.calls, [call.id]: { status: "running", runId } } }))
  }

  const run = await waitForRun(runId)
  if (run?.status === "canceled" || stopping.has(sessionId)) return { result: stoppedResult(sessionId, call) }
  if (run?.status !== "completed" || !run.outputs) {
    const message = run?.error?.message ?? "The generation did not finish."
    const out = fail(message)
    return FATAL.has(run?.error?.code ?? "") ? { ...out, fatal: message } : out
  }

  const urls = run.outputs.video ? [run.outputs.video.url] : (run.outputs.images ?? []).map((i) => i.url)
  const kind: AgentAsset["kind"] = run.outputs.video ? "video" : "image"
  const title = typeof call.input.title === "string" ? call.input.title : undefined
  const ids: string[] = []
  patch(sessionId, (a) => {
    const assets = [...a.assets]
    for (const url of urls) {
      const id = nextAssetId({ ...a, assets }, "a")
      ids.push(id)
      assets.push({ id, kind, url, source: "generated", model: run.model, callId: call.id, ...(title ? { title } : {}) })
    }
    return { ...a, assets, calls: { ...a.calls, [call.id]: { status: "done", runId, assetIds: ids } } }
  })
  return { result: resultFromState(agentOf(sessionId)!, call) }
}

function stoppedResult(sessionId: string, call: ToolCall): ToolResult {
  patch(sessionId, (a) => ({ ...a, calls: { ...a.calls, [call.id]: { ...a.calls[call.id], status: "stopped" } } }))
  return { id: call.id, ok: false, text: "Stopped by the user before it finished." }
}

function resultFromState(agent: AgentState, call: ToolCall): ToolResult {
  const state = agent.calls[call.id]
  if (state?.status !== "done") return { id: call.id, ok: false, text: state?.error ?? "The generation did not finish." }
  const assets = (state.assetIds ?? []).map((id) => agent.assets.find((a) => a.id === id)).filter((a): a is AgentAsset => Boolean(a))
  const left = Math.max(0, MAX_GENERATIONS_PER_RUN - agent.generations)
  const what = assets.map((a) => `${a.id} (${a.kind}${a.model ? `, ${a.model}` : ""})`).join(", ")
  const images = assets.filter((a) => a.kind === "image").map((a) => a.url)
  return {
    id: call.id,
    ok: true,
    text: `Done: ${what}.${images.length ? " Review the image(s) below." : " (Video — you cannot watch it; judge by its keyframe.)"} Generations left this run: ${left}.`,
    ...(images.length ? { images } : {}),
  }
}

/** Tool input → a validated studio submission (catalog model, settings and inputs checked like plan steps). */
function prepare(
  agent: AgentState,
  call: ToolCall,
): { submit: Parameters<typeof submitRun>[0] } | { error: string } {
  if (call.name === "ask_user") return { error: "ask_user is answered by the user, not executed." }
  const input = call.input as GenerateImageInput | GenerateVideoInput
  const tool = call.name as "generate_image" | "generate_video"
  // Every image asset becomes an "upload" slot so the plan validator can check references.
  const images = agent.assets.filter((a) => a.kind === "image")
  const slots: UploadInfo[] = images.map((a) => ({ url: a.url, kind: "image" }))
  const unknown: string[] = []
  const ref = (id: string | undefined): string => {
    if (!id) return ""
    const index = images.findIndex((a) => a.id === id.trim())
    if (index < 0) {
      unknown.push(id)
      return ""
    }
    return `upload:${index}`
  }
  const video = tool === "generate_video" ? (input as GenerateVideoInput) : null
  const plan = normalizePlan(
    {
      reply: "",
      title: "",
      steps: [
        {
          id: "s1",
          tool,
          title: input.title,
          model: input.model?.trim() || "auto",
          prompt: input.prompt,
          settings: Object.entries(input.settings ?? {}).map(([key, value]) => ({ key, value: String(value) })),
          start_frame: ref(video?.start_frame),
          end_frame: ref(video?.end_frame),
          references: (input.references ?? []).map(ref).filter(Boolean),
        },
      ],
    },
    slots,
  )
  const step = plan.steps[0]
  if (!step) return { error: "No installed model can take this request with these inputs. Try another model or fewer references." }
  if (unknown.length) return { error: `Unknown image asset id(s): ${unknown.join(", ")}. Use ids from earlier results (videos cannot be references).` }

  const url = (r: Ref | null) => (r?.type === "upload" ? (slots[r.index]?.url ?? null) : null)
  const media: MediaItem[] = []
  const push = (role: MediaRole, u: string | null) => {
    if (u) media.push({ id: crypto.randomUUID(), url: u, role, kind: "image" })
  }
  push("start", url(step.startFrame))
  push("end", url(step.endFrame))
  for (const r of step.references) push("reference", url(r))

  let inputMode: string | undefined
  try {
    inputMode = inferInputMode(getModel(step.model), media)
  } catch {
    inputMode = undefined
  }
  return {
    submit: {
      surface: surfaceOf(step.tool)!,
      model: step.model,
      prompt: step.prompt,
      settings: step.settings,
      media,
      ...(inputMode ? { inputMode } : {}),
    },
  }
}

export type { AskUserInput }

/* ─── Higgsfield Supercomputer (Agent API) ─────────────────────────────── */

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i
const URL_RE = /https?:\/\/[^\s)\]>"'\u0600-\u06FF]+/g
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Opening context for a new Higgsfield session. */
const HF_PREAMBLE = `[Context: you are working for ${APP_NAME}, a creative agency in the Arab market. Reply in the language the owner writes in (often Egyptian Arabic). Default to the best resolution available and the right aspect ratio for the platform. Review your keyframes before animating, keep products and characters consistent across shots, and finish with the deliverables' links in order.]

`

async function sendToHiggsfield(
  sessionId: string,
  text: string,
  uploads: Array<{ url: string; kind: AgentAsset["kind"]; name?: string }>,
) {
  const files = addUploads(sessionId, uploads)
  useSuperComputer.setState((state) => ({
    sessions: state.sessions.map((s) => (s.id === sessionId && !s.title ? { ...s, title: text.trim().slice(0, 60) } : s)),
  }))
  patch(sessionId, (a) => ({
    ...a,
    status: "thinking",
    error: undefined,
    runStartedAt: Date.now(),
    runEndedAt: undefined,
    generations: 0,
    turns: 0,
    transcript: [...a.transcript, { role: "user", text: text.trim(), uploads: files }],
  }))

  let agent = agentOf(sessionId)!
  if (!agent.hf) {
    const started = await hfAgentStart().catch(() => null)
    if (!started?.ok) {
      patch(sessionId, (a) => ({ ...a, status: "error", runEndedAt: Date.now(), error: started?.error.message ?? "Could not reach Higgsfield." }))
      return
    }
    patch(sessionId, (a) => ({ ...a, hf: { sessionId: started.data.sessionId, seen: [] } }))
    agent = agentOf(sessionId)!
  }

  // Director mode: Claude (when configured) turns the message into a full production brief.
  const history = agent.transcript
    .slice(-8, -1)
    .flatMap((t) => (t.role === "user" ? [`Owner: ${t.text}`] : t.role === "assistant" && t.text ? [`Agent: ${t.text}`] : []))
    .join("\n")
    .slice(-6000)
  const directed = await writeDirectorBrief({
    text: text.trim() || "(see attached files)",
    files: files.map((f) => ({ kind: f.kind, url: f.url })),
    memory: sc().memory,
    history,
  }).catch(() => null)
  const brief = directed?.ok ? directed.data.brief : null
  if (brief) {
    patch(sessionId, (a) => {
      const transcript = [...a.transcript]
      const last = transcript[transcript.length - 1]
      if (last?.role === "user") transcript[transcript.length - 1] = { ...last, brief }
      return { ...a, transcript }
    })
  }

  const first = !agent.hf!.cursor
  const mem = memoryContext(agent)
  const attachments = files.length ? `\n\nAttached files:\n${files.map((f) => `- ${f.kind}: ${f.url}`).join("\n")}` : ""
  const content = brief
    ? `${first ? HF_PREAMBLE : ""}${brief}\n\n---\nThe owner's original words: "${text.trim()}"${attachments}`
    : `${first ? HF_PREAMBLE : ""}${mem.context ? `${mem.context}\n\n` : ""}${text.trim()}${attachments}`
  if (mem.sent !== undefined) patch(sessionId, (a) => ({ ...a, memorySent: mem.sent }))
  const sent = await hfAgentSend({ sessionId: agent.hf!.sessionId, content }).catch(() => null)
  if (!sent?.ok) {
    patch(sessionId, (a) => ({ ...a, status: "error", runEndedAt: Date.now(), error: sent?.error.message ?? "Could not reach Higgsfield." }))
    return
  }
  patch(sessionId, (a) => ({ ...a, hf: { ...a.hf!, cursor: sent.data.messageId, live: undefined } }))
  await pollHiggsfield(sessionId)
}

/** Polls the Higgsfield turn (2s → 10s backoff) until it completes, fails or asks a question. */
async function pollHiggsfield(sessionId: string) {
  if (driving.has(sessionId)) return
  driving.add(sessionId)
  stopping.delete(sessionId)
  let delay = 2000
  let failures = 0
  try {
    for (;;) {
      const agent = agentOf(sessionId)
      const hf = agent?.hf
      if (!agent || !hf?.cursor) return
      if (stopping.has(sessionId)) {
        await hfAgentInterrupt({ sessionId: hf.sessionId }).catch(() => null)
        patch(sessionId, (a) => ({ ...a, status: "stopped", runEndedAt: Date.now(), hf: { ...a.hf!, live: undefined } }))
        return
      }
      await sleep(delay)
      delay = Math.min(delay * 1.5, 10_000)

      const res = await hfAgentPoll({ sessionId: hf.sessionId, after: hf.cursor }).catch(() => null)
      if (!res?.ok) {
        if ((!res || res.error.code === "network" || res.error.code === "platform_error") && ++failures < 6) continue
        patch(sessionId, (a) => ({ ...a, status: "error", runEndedAt: Date.now(), error: res?.error.message ?? "Lost contact with Higgsfield." }))
        return
      }
      failures = 0
      const assistants = res.data.messages.filter((m) => m.role === "assistant" && m.id)
      const finished = assistants.filter((m) => m.status !== "processing" && !hf.seen.includes(m.id))
      for (const m of finished) appendHiggsfieldReply(sessionId, m.id, m.text, m.status === "failed")
      const live = [...assistants].reverse().find((m) => m.status === "processing")?.text
      patch(sessionId, (a) => ({ ...a, hf: { ...a.hf!, live: live || undefined } }))

      const ended = assistants.some((m) => m.status !== "processing")
      if (ended) {
        const failed = assistants[assistants.length - 1]?.status === "failed"
        patch(sessionId, (a) => ({
          ...a,
          status: failed ? "error" : "done",
          runEndedAt: Date.now(),
          ...(failed ? { error: "The Higgsfield agent could not finish this. Press Continue or rephrase." } : {}),
          hf: { ...a.hf!, live: undefined },
        }))
        return
      }
      if (res.data.status === "awaiting_input") {
        // The question is the latest assistant row (possibly still marked processing).
        const question = assistants[assistants.length - 1]
        if (question && !agentOf(sessionId)!.hf!.seen.includes(question.id)) appendHiggsfieldReply(sessionId, question.id, question.text, false)
        patch(sessionId, (a) => ({ ...a, status: "waiting", runEndedAt: Date.now(), hf: { ...a.hf!, live: undefined } }))
        return
      }
    }
  } finally {
    driving.delete(sessionId)
    stopping.delete(sessionId)
  }
}

/** Adds one Higgsfield reply to the chat; the media links in it become assets. */
function appendHiggsfieldReply(sessionId: string, rowId: string, text: string, failed: boolean) {
  const urls = [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, "")))]
  patch(sessionId, (a) => {
    const assets = [...a.assets]
    const ids: string[] = []
    for (const url of urls) {
      const kind: AgentAsset["kind"] | null = VIDEO_EXT.test(url) ? "video" : IMAGE_EXT.test(url) ? "image" : null
      if (!kind) continue
      const existing = assets.find((x) => x.url === url)
      if (existing) {
        ids.push(existing.id)
        continue
      }
      const id = nextAssetId({ ...a, assets }, "a")
      assets.push({ id, kind, url, source: "generated", model: "Higgsfield" })
      ids.push(id)
    }
    const turn: AgentTurn = {
      role: "assistant",
      text: text.trim() || (failed ? "" : "…"),
      calls: [],
      model: HF_AGENT_ID,
      ...(ids.length ? { assetIds: ids } : {}),
    }
    return { ...a, assets, transcript: [...a.transcript, turn], hf: { ...a.hf!, seen: [...a.hf!.seen, rowId] } }
  })
}
