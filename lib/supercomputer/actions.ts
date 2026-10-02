"use server"

import { z } from "zod"

import { MAX_MESSAGE_CHARS, MAX_PROMPT_CHARS } from "@/lib/config"
import { MODELS } from "@/generation/catalog"
import { getViewer } from "@/generation/server-credentials"
import { isSupabaseConfigured } from "@/lib/env"
import { getLLM, resolveProviderId, type LLMProviderId } from "@/lib/llm"
import { LLMError } from "@/lib/llm/types"
import { createClient } from "@/lib/supabase/server"
import { getTeamContext } from "@/lib/team/server"
import { normalizePlan, type Plan } from "./plan"
import { buildPlannerSystemPrompt } from "./system-prompt"

export type AssistantError = { code: string; message: string }
export type AssistantResult<T> = { ok: true; data: T } | { ok: false; error: AssistantError }

const fail = (code: string, message: string): { ok: false; error: AssistantError } => ({ ok: false, error: { code, message } })

/* ─── Guards ───────────────────────────────────────────────────────────── */

const CALLS_PER_MINUTE = 20
const callLog = new Map<string, number[]>()

async function guard(): Promise<AssistantError | null> {
  const viewer = await getViewer()
  if (!viewer) return { code: "unauthenticated", message: "Sign in to continue." }
  const owner = viewer.userId ?? "preview"
  const now = Date.now()
  const recent = (callLog.get(owner) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= CALLS_PER_MINUTE) return { code: "rate_limited", message: "Too many requests. Wait a moment." }
  recent.push(now)
  callLog.set(owner, recent)
  return null
}

function fromCaught(caught: unknown): { ok: false; error: AssistantError } {
  if (caught instanceof LLMError) return fail(caught.code, caught.message)
  console.error("[supercomputer] unexpected error", caught instanceof Error ? caught.message : caught)
  return fail("provider_error", "Something went wrong. Try again.")
}

/* ─── Status ───────────────────────────────────────────────────────────── */

export async function getAssistantStatus(): Promise<{ provider: LLMProviderId; textTools: boolean }> {
  const provider = resolveProviderId()
  return { provider, textTools: provider !== "builtin" }
}

/* ─── Planner ──────────────────────────────────────────────────────────── */

const PlanInput = z.object({
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(MAX_MESSAGE_CHARS) }))
    .min(1)
    .max(24),
  uploads: z
    .array(z.object({ url: z.string().url().startsWith("https://"), kind: z.enum(["image", "video", "audio"]) }))
    .max(8),
})

export type PlanResponse = { reply: string; plan: Plan; provider: LLMProviderId }

/**
 * Chat turn → reply + validated plan. The LLM output is untrusted: it is
 * normalized against the installed catalog before it reaches the UI, and
 * nothing is generated until the user presses "Run".
 */
export async function planPipeline(input: unknown): Promise<AssistantResult<PlanResponse>> {
  const blocked = await guard()
  if (blocked) return { ok: false, error: blocked }
  const parsed = PlanInput.safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  const { turns, uploads } = parsed.data
  if (turns[turns.length - 1]?.role !== "user") return fail("invalid_input", "The last message must be yours.")

  const uploadNote = uploads.length
    ? `\n\n[Attached files: ${uploads.map((u, i) => `upload:${i} (${u.kind})`).join(", ")}]`
    : ""
  const withNote = turns.map((t, i) => (i === turns.length - 1 ? { ...t, text: t.text + uploadNote } : t))

  try {
    const disabled = (await getTeamContext())?.settings.disabledModels ?? []
    const llm = getLLM()
    const draft = await llm.plan({
      system: buildPlannerSystemPrompt(disabled),
      turns: withNote,
      images: uploads.filter((u) => u.kind === "image").map((u) => u.url),
    })
    return { ok: true, data: { reply: draft.reply.trim(), plan: normalizePlan(draft, uploads, disabled), provider: llm.id } }
  } catch (caught) {
    return fromCaught(caught)
  }
}

/* ─── Text tools ───────────────────────────────────────────────────────── */

const ScriptInput = z.object({ brief: z.string().min(1).max(MAX_MESSAGE_CHARS), context: z.string().max(MAX_MESSAGE_CHARS).default("") })

export async function writeScript(input: unknown): Promise<AssistantResult<{ text: string }>> {
  const blocked = await guard()
  if (blocked) return { ok: false, error: blocked }
  const parsed = ScriptInput.safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  try {
    const text = await getLLM().text({
      system:
        "You are a senior copywriter at a creative agency writing short-form video and social content. Write exactly what the brief asks for (hooks, captions, voice-over, storyboard or shot list), ready to use. Match the language of the brief. Use short lines and simple numbered lists; no preamble.",
      prompt: parsed.data.context ? `${parsed.data.brief}\n\nProduction context:\n${parsed.data.context}` : parsed.data.brief,
      maxTokens: 4000,
    })
    return { ok: true, data: { text } }
  } catch (caught) {
    return fromCaught(caught)
  }
}

const EnhanceInput = z.object({ prompt: z.string().min(1).max(MAX_PROMPT_CHARS), model: z.string().max(64) })

/** "✨ Enhance prompt" in the studios: rewrites a rough idea into a production prompt for the chosen model. */
export async function enhancePrompt(input: unknown): Promise<AssistantResult<{ prompt: string }>> {
  const blocked = await guard()
  if (blocked) return { ok: false, error: blocked }
  const parsed = EnhanceInput.safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  const model = MODELS.find((m) => m.id === parsed.data.model)
  const kind = model?.surface === "video" ? "video" : "image"
  try {
    const text = await getLLM().text({
      system: `You rewrite rough ideas into one production-ready ${kind} generation prompt${model ? ` for ${model.label}` : ""}. Write in English regardless of the input language. Cover subject, ${kind === "video" ? "action, camera movement, " : ""}setting, composition, lighting, mood and style in 2–5 sentences. Keep every concrete detail the user gave (products, colors, text, people). Output only the prompt.`,
      prompt: parsed.data.prompt,
      maxTokens: 1000,
    })
    return { ok: true, data: { prompt: text.replace(/^["']|["']$/g, "").trim() } }
  } catch (caught) {
    return fromCaught(caught)
  }
}

/* ─── Recipes (saved pipelines) ────────────────────────────────────────── */

export type Recipe = { id: string; name: string; plan: Plan; createdAt: number }

const RecipeInput = z.object({
  name: z.string().trim().min(1).max(80),
  plan: z.object({ title: z.string().max(120), steps: z.array(z.record(z.string(), z.unknown())).min(1).max(8) }),
})

/** `null` = Supabase not configured → the client keeps recipes in localStorage. */
export async function listRecipes(): Promise<AssistantResult<Recipe[] | null>> {
  if (!isSupabaseConfigured) return { ok: true, data: null }
  const viewer = await getViewer()
  if (!viewer?.userId) return fail("unauthenticated", "Sign in to continue.")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, plan, created_at")
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return fail("provider_error", error.message)
  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      plan: r.plan as Plan,
      createdAt: Date.parse(r.created_at as string),
    })),
  }
}

export async function saveRecipe(input: unknown): Promise<AssistantResult<Recipe | null>> {
  const parsed = RecipeInput.safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid recipe.")
  if (!isSupabaseConfigured) return { ok: true, data: null }
  const viewer = await getViewer()
  if (!viewer?.userId) return fail("unauthenticated", "Sign in to continue.")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recipes")
    .insert({ user_id: viewer.userId, name: parsed.data.name, plan: parsed.data.plan })
    .select("id, name, plan, created_at")
    .single()
  if (error || !data) return fail("provider_error", error?.message ?? "Could not save.")
  return {
    ok: true,
    data: { id: data.id as string, name: data.name as string, plan: data.plan as Plan, createdAt: Date.parse(data.created_at as string) },
  }
}

export async function deleteRecipe(input: unknown): Promise<AssistantResult<null>> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid id.")
  if (!isSupabaseConfigured) return { ok: true, data: null }
  const viewer = await getViewer()
  if (!viewer?.userId) return fail("unauthenticated", "Sign in to continue.")
  const supabase = await createClient()
  const { error } = await supabase.from("recipes").delete().eq("id", parsed.data.id)
  if (error) return fail("provider_error", error.message)
  return { ok: true, data: null }
}
