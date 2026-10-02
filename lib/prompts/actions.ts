"use server"

import { z } from "zod"

import { MAX_PROMPT_CHARS } from "@/lib/config"
import { getTeamContext } from "@/lib/team/server"
import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/team/actions"

export type SavedPrompt = {
  id: string
  title: string
  body: string
  tags: string[]
  surface: "image" | "video" | "any"
  createdAt: number
  mine: boolean
}

/** Team prompts; `null` = preview mode (the client keeps prompts locally). */
export async function listPrompts(): Promise<ActionResult<SavedPrompt[] | null>> {
  const team = await getTeamContext()
  if (!team) return { ok: true, data: null }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prompts")
    .select("id, title, body, tags, surface, created_at, created_by")
    .eq("team_id", team.team.id)
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: (data ?? []).map((p) => ({
      id: p.id as string,
      title: p.title as string,
      body: p.body as string,
      tags: (p.tags as string[]) ?? [],
      surface: p.surface as SavedPrompt["surface"],
      createdAt: Date.parse(p.created_at as string),
      mine: p.created_by === team.userId,
    })),
  }
}

const PromptInput = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(MAX_PROMPT_CHARS),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10),
  surface: z.enum(["image", "video", "any"]),
})

export async function savePrompt(input: unknown): Promise<ActionResult<SavedPrompt | null>> {
  const parsed = PromptInput.extend({ id: z.string().uuid().optional() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "A title and a prompt are required." }
  const team = await getTeamContext()
  if (!team) return { ok: true, data: null }
  const supabase = await createClient()
  const { id, ...fields } = parsed.data
  const tags = [...new Set(fields.tags)]
  const query = id
    ? supabase.from("prompts").update({ ...fields, tags }).eq("id", id)
    : supabase.from("prompts").insert({ ...fields, tags, team_id: team.team.id, created_by: team.userId })
  const { data, error } = await query.select("id, title, body, tags, surface, created_at").single()
  if (error || !data) return { ok: false, error: error?.message ?? "You can only edit your own prompts." }
  return {
    ok: true,
    data: {
      id: data.id as string,
      title: data.title as string,
      body: data.body as string,
      tags: data.tags as string[],
      surface: data.surface as SavedPrompt["surface"],
      createdAt: Date.parse(data.created_at as string),
      mine: true,
    },
  }
}

export async function deletePrompt(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid prompt." }
  const supabase = await createClient()
  const { data, error } = await supabase.from("prompts").delete().eq("id", parsed.data.id).select("id")
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "You can only delete your own prompts." }
  return { ok: true, data: null }
}
