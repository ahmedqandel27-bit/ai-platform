"use server"

import { z } from "zod"

import { getTeamContext } from "@/lib/team/server"
import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/team/actions"

export type Project = { id: string; name: string; createdAt: number; jobs: number; cover: string | null }

/** Projects of the active team, with job counts. */
export async function listProjects(): Promise<ActionResult<Project[] | null>> {
  const team = await getTeamContext()
  if (!team) return { ok: true, data: null }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at, jobs(count)")
    .eq("team_id", team.team.id)
    .order("created_at", { ascending: false })
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: (data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      createdAt: Date.parse(p.created_at as string),
      jobs: ((p.jobs as Array<{ count: number }> | null)?.[0]?.count as number) ?? 0,
      cover: null,
    })),
  }
}

const Name = z.string().trim().min(1).max(80)

export async function createProject(input: unknown): Promise<ActionResult<Project>> {
  const team = await getTeamContext()
  if (!team) return { ok: false, error: "Sign in to continue." }
  const parsed = z.object({ name: Name }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Enter a project name." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .insert({ team_id: team.team.id, name: parsed.data.name, created_by: team.userId })
    .select("id, name, created_at")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the project." }
  return { ok: true, data: { id: data.id as string, name: data.name as string, createdAt: Date.parse(data.created_at as string), jobs: 0, cover: null } }
}

export async function renameProject(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), name: Name }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Enter a project name." }
  const supabase = await createClient()
  const { error } = await supabase.from("projects").update({ name: parsed.data.name }).eq("id", parsed.data.id)
  return error ? { ok: false, error: error.message } : { ok: true, data: null }
}

/** Deletes the project; its generations stay in each member's library (unfiled). */
export async function deleteProject(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid project." }
  const supabase = await createClient()
  const { data, error } = await supabase.from("projects").delete().eq("id", parsed.data.id).select("id")
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "Only the creator or an admin can delete this project." }
  return { ok: true, data: null }
}

export async function getProject(input: unknown): Promise<ActionResult<{ id: string; name: string } | null>> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: true, data: null }
  const supabase = await createClient()
  const { data } = await supabase.from("projects").select("id, name").eq("id", parsed.data.id).maybeSingle()
  return { ok: true, data: data ? { id: data.id as string, name: data.name as string } : null }
}
