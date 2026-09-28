"use client"

import type { ChatTurn } from "@/lib/llm/types"
import { planPipeline } from "./actions"
import { modelLabel, sanitizePlan, type Plan, type UploadInfo } from "./plan"
import { toPlanState, useSuperComputer, type ChatMessage, type ChatUploadItem } from "./store"

const MAX_TURNS = 12
const MAX_UPLOADS = 8

/** Every file attached in this session, oldest first — "upload:<n>" indexes into this list. */
export function sessionUploads(messages: ChatMessage[]): ChatUploadItem[] {
  return messages.flatMap((m) => m.uploads ?? []).slice(-MAX_UPLOADS)
}

/** Assistant turns are replayed as text: the reply plus a compact plan summary for follow-ups. */
function toTurn(message: ChatMessage): ChatTurn {
  if (message.role === "user") return { role: "user", text: message.text || "(attached files)" }
  const plan = message.plan
  const summary = plan?.steps.length
    ? `\n[Current plan "${plan.title}": ${plan.steps
        .map((s) => `${s.id} ${s.tool}${s.model ? ` model=${s.model}` : ""} prompt="${s.prompt.slice(0, 300)}"`)
        .join(" | ")}]`
    : ""
  return { role: "assistant", text: (message.text || message.error || "…") + summary }
}

export async function sendMessage(sessionId: string, text: string, uploads: ChatUploadItem[]) {
  const sc = useSuperComputer.getState()
  const user: ChatMessage = { id: crypto.randomUUID(), role: "user", text: text.trim(), uploads, createdAt: Date.now() }
  const assistant: ChatMessage = { id: crypto.randomUUID(), role: "assistant", text: "", pending: true, createdAt: Date.now() }
  sc.addMessage(sessionId, user)
  sc.addMessage(sessionId, assistant)

  const session = useSuperComputer.getState().sessions.find((s) => s.id === sessionId)
  const history = (session?.messages ?? []).filter((m) => m.id !== assistant.id && !m.pending)
  const turns = history.slice(-MAX_TURNS).map(toTurn)
  // The API needs the conversation to start with a user turn.
  while (turns.length && turns[0]!.role !== "user") turns.shift()
  const all = sessionUploads(history)
  const files: UploadInfo[] = all.map(({ url, kind }) => ({ url, kind }))

  let result: Awaited<ReturnType<typeof planPipeline>>
  try {
    result = await planPipeline({ turns, uploads: files })
  } catch {
    result = { ok: false, error: { code: "network", message: "Connection lost. Try again." } }
  }

  if (!result.ok) {
    sc.patchMessage(sessionId, assistant.id, { pending: false, error: result.error.message })
    return
  }
  const { reply, plan } = result.data
  sc.patchMessage(sessionId, assistant.id, {
    pending: false,
    text: reply,
    ...(plan.steps.length ? { plan: toPlanState(plan, files) } : {}),
  })
}

/** Drops a saved recipe into the chat as a ready-to-run plan. */
export function insertRecipe(sessionId: string, name: string, stored: Plan, intro: string) {
  const plan = sanitizePlan(stored)
  if (!plan?.steps.length) return false
  // Recipes cannot carry the original uploads: detach upload inputs.
  const steps = plan.steps.map((s) => ({
    ...s,
    startFrame: s.startFrame?.type === "upload" ? null : s.startFrame,
    endFrame: s.endFrame?.type === "upload" ? null : s.endFrame,
    references: s.references.filter((r) => r.type !== "upload"),
  }))
  useSuperComputer.getState().addMessage(sessionId, {
    id: crypto.randomUUID(),
    role: "assistant",
    text: `${intro} “${name}”`,
    plan: toPlanState({ title: plan.title || name, steps }, []),
    createdAt: Date.now(),
  })
  return true
}

export { modelLabel }
