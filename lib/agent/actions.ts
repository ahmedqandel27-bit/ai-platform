"use server"

import { z } from "zod"

import { getViewer } from "@/generation/server-credentials"
import { LLMError } from "@/lib/llm/types"
import { getTeamContext } from "@/lib/team/server"
import { anthropicAgentTurn, anthropicDirectorBrief } from "./anthropic"
import { availableAgentModels, findAgentModel, hasAnthropic, loopModels } from "./models"
import { PLAYBOOK } from "./playbook"
import { openRouterAgentTurn } from "./openrouter"
import { buildAgentSystemPrompt } from "./system-prompt"
import { EFFORTS, type AgentModelInfo, type AgentTurn, type AgentTurnResponse } from "./types"

type Failure = { ok: false; error: { code: string; message: string } }
const fail = (code: string, message: string): Failure => ({ ok: false, error: { code, message } })

const TURNS_PER_MINUTE = 30
const callLog = new Map<string, number[]>()

/** Thinking models this deployment can run (empty → the classic planner is used). */
export async function listAgentModels(): Promise<AgentModelInfo[]> {
  return availableAgentModels()
}

const Upload = z.object({ id: z.string().max(16), url: z.string().url().max(4000), kind: z.enum(["image", "video", "audio"]) })
const Call = z.object({
  id: z.string().max(128),
  name: z.enum(["generate_image", "generate_video", "remember", "ask_user"]),
  input: z.record(z.string(), z.unknown()),
  invalid: z.string().optional(),
})
const Turn = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    text: z.string().max(12_000),
    uploads: z.array(Upload).max(8),
    context: z.string().max(8000).optional(),
    brief: z.string().max(12_000).optional(),
  }),
  z.object({
    role: z.literal("assistant"),
    text: z.string().max(40_000),
    thinking: z.string().max(80_000).optional(),
    calls: z.array(Call).max(16),
    raw: z.object({ provider: z.literal("anthropic"), content: z.array(z.unknown()).max(64) }).optional(),
    model: z.string().max(128),
    assetIds: z.array(z.string().max(16)).max(32).optional(),
  }),
  z.object({
    role: z.literal("tool"),
    results: z
      .array(z.object({ id: z.string().max(128), ok: z.boolean(), text: z.string().max(8000), images: z.array(z.string().url().max(4000)).max(8).optional() }))
      .max(16),
    answer: z.object({ text: z.string().max(12_000), uploads: z.array(Upload).max(8) }).optional(),
  }),
])

const TurnInput = z.object({
  model: z.string().max(128),
  effort: z.enum(EFFORTS),
  transcript: z.array(Turn).min(1).max(400),
})

/**
 * One step of the agent: the transcript so far → the model's next message
 * (text + tool calls). The loop itself runs in the browser, which executes the
 * generations through the same path as the studios and calls this again with
 * the results, so no request has to outlive a serverless time limit.
 */
export async function agentTurn(input: unknown): Promise<{ ok: true; data: AgentTurnResponse } | Failure> {
  const viewer = await getViewer()
  if (!viewer) return fail("unauthenticated", "Sign in to continue.")
  const owner = viewer.userId ?? "preview"
  const now = Date.now()
  const recent = (callLog.get(owner) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= TURNS_PER_MINUTE) return fail("rate_limited", "Too many requests. Wait a moment.")
  recent.push(now)
  callLog.set(owner, recent)

  const parsed = TurnInput.safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  const { model, effort, transcript } = parsed.data
  if (transcript[0]?.role !== "user") return fail("invalid_input", "The conversation must start with a message from you.")
  // An unknown or retired choice falls back to the deployment's default model.
  const info = findAgentModel(model) ?? loopModels()[0]
  if (!info)
    return fail("not_configured", "No thinking model is configured on the server. Add ANTHROPIC_API_KEY or OPENROUTER_API_KEY in Vercel, or pick Higgsfield Supercomputer.")

  try {
    const disabled = (await getTeamContext())?.settings.disabledModels ?? []
    const system = buildAgentSystemPrompt(disabled)
    const data =
      info.provider === "anthropic"
        ? await anthropicAgentTurn({ model: info.id, effort, system, transcript: transcript as AgentTurn[] })
        : await openRouterAgentTurn({ model: info.id, system, transcript: transcript as AgentTurn[] })
    return { ok: true, data }
  } catch (caught) {
    if (caught instanceof LLMError) return fail(caught.code, caught.message)
    console.error("[agent] unexpected error", caught instanceof Error ? caught.message : caught)
    return fail("provider_error", "Something went wrong. Try again.")
  }
}

const DIRECTOR_SYSTEM = `You are the creative director of an Arab-market creative agency. You turn the owner's quick message (often Egyptian or Gulf Arabic) into a production brief for Higgsfield's Supercomputer, an AI agent that generates the images and videos with Higgsfield's tools.

Write the brief in English, decisive and specific, max ~350 words:
1. Concept — one sentence: the idea and the feeling.
2. Deliverables — each piece with platform, aspect ratio, duration, count, resolution (default 1080p or the best available).
3. Look & feel — palette, lighting, lens/camera style, references to keep consistent (attached files by their links).
4. Shot list — numbered; for each shot: what we see, camera move, lighting, and a ready-to-use prompt line.
5. Copy — hooks/captions/CTA in the user's language when the job needs them.
6. Working rules — generate keyframes first and review them, keep product/character identical across shots, deliver links in order.
Resolve ambiguity with the best creative choice; never ask questions. Apply the studio memory. Output only the brief.

${PLAYBOOK}`

const BriefInput = z.object({
  text: z.string().min(1).max(12_000),
  files: z.array(z.object({ kind: z.string().max(16), url: z.string().url().max(4000) })).max(8),
  memory: z.array(z.string().max(300)).max(40),
  history: z.string().max(12_000).default(""),
})

/**
 * Director mode for Higgsfield runs: with a Claude key on the server, the
 * user's message is rewritten into a full production brief first. Without
 * one it returns null and the message goes to Higgsfield as written.
 */
export async function writeDirectorBrief(input: unknown): Promise<{ ok: true; data: { brief: string | null } } | Failure> {
  const viewer = await getViewer()
  if (!viewer) return fail("unauthenticated", "Sign in to continue.")
  if (!hasAnthropic()) return { ok: true, data: { brief: null } }
  const parsed = BriefInput.safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  const { text, files, memory, history } = parsed.data
  const request = [
    memory.length ? `Studio memory (standing preferences):\n${memory.map((m) => `- ${m}`).join("\n")}` : "",
    history ? `Conversation so far (for context):\n${history}` : "",
    `New message from the owner:\n${text}`,
    files.length ? `Attached files:\n${files.map((f) => `- ${f.kind}: ${f.url}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
  try {
    return { ok: true, data: { brief: await anthropicDirectorBrief({ system: DIRECTOR_SYSTEM, request }) } }
  } catch (caught) {
    // The brief is an upgrade, not a gate: on failure the message goes out as written.
    console.error("[agent] director brief failed", caught instanceof Error ? caught.message : caught)
    return { ok: true, data: { brief: null } }
  }
}
