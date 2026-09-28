"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { MODELS } from "@/generation/catalog"
import { createClient } from "@/lib/supabase/server"
import { sanitizeCosts } from "./cost"
import { getTeamContext, TEAM_COOKIE } from "./server"
import type { TeamContext, TeamRole } from "./types"

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string }

const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data })
const err = (error: string): ActionResult<never> => ({ ok: false, error })

export async function loadTeamContext(): Promise<TeamContext | null> {
  return getTeamContext()
}

async function requireAdmin(): Promise<TeamContext | string> {
  const team = await getTeamContext()
  if (!team) return "Sign in to continue."
  if (!team.isAdmin) return "Only team owners and admins can change this."
  return team
}

/* ─── Team switcher / profile ──────────────────────────────────────────── */

export async function switchTeam(teamId: string): Promise<ActionResult> {
  const team = await getTeamContext()
  if (!team?.teams.some((t) => t.id === teamId)) return err("You are not a member of that team.")
  ;(await cookies()).set(TEAM_COOKIE, teamId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 })
  revalidatePath("/", "layout")
  return ok(null)
}

const TeamInput = z.object({
  name: z.string().trim().min(1).max(80),
  monthlyBudget: z.number().min(0).max(100_000_000).nullable(),
})

export async function updateTeam(input: unknown): Promise<ActionResult> {
  const team = await requireAdmin()
  if (typeof team === "string") return err(team)
  const parsed = TeamInput.safeParse(input)
  if (!parsed.success) return err("Invalid team settings.")
  const supabase = await createClient()
  const { error } = await supabase
    .from("teams")
    .update({ name: parsed.data.name, monthly_budget: parsed.data.monthlyBudget })
    .eq("id", team.team.id)
  if (error) return err(error.message)
  revalidatePath("/", "layout")
  return ok(null)
}

/* ─── Members ──────────────────────────────────────────────────────────── */

export type Member = { userId: string; email: string; fullName: string | null; role: TeamRole; dailyCap: number | null; joinedAt: string }

export async function listMembers(): Promise<ActionResult<Member[]>> {
  const team = await getTeamContext()
  if (!team) return err("Sign in to continue.")
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("team_members_list", { p_team: team.team.id })
  if (error) return err(error.message)
  return ok(
    ((data ?? []) as Array<Record<string, unknown>>).map((m) => ({
      userId: m.user_id as string,
      email: m.email as string,
      fullName: (m.full_name as string | null) ?? null,
      role: m.role as TeamRole,
      dailyCap: m.daily_cap === null ? null : Number(m.daily_cap),
      joinedAt: m.joined_at as string,
    })),
  )
}

const Role = z.enum(["owner", "admin", "member"])

export async function addMember(input: unknown): Promise<ActionResult> {
  const team = await requireAdmin()
  if (typeof team === "string") return err(team)
  const parsed = z.object({ email: z.string().trim().email().max(320), role: Role }).safeParse(input)
  if (!parsed.success) return err("Enter a valid e-mail.")
  const supabase = await createClient()
  const { error } = await supabase.rpc("add_team_member", { p_team: team.team.id, p_email: parsed.data.email, p_role: parsed.data.role })
  if (error) return err(error.message)
  return ok(null)
}

export async function updateMember(input: unknown): Promise<ActionResult> {
  const team = await requireAdmin()
  if (typeof team === "string") return err(team)
  const parsed = z
    .object({ userId: z.string().uuid(), role: Role, dailyCap: z.number().min(0).max(100_000_000).nullable() })
    .safeParse(input)
  if (!parsed.success) return err("Invalid member settings.")
  const supabase = await createClient()
  const { error } = await supabase.rpc("update_team_member", {
    p_team: team.team.id,
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
    p_daily_cap: parsed.data.dailyCap,
  })
  if (error) return err(error.message)
  return ok(null)
}

export async function removeMember(input: unknown): Promise<ActionResult> {
  const team = await getTeamContext()
  if (!team) return err("Sign in to continue.")
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return err("Invalid member.")
  const supabase = await createClient()
  // The RPC enforces who may remove whom (and keeps at least one owner).
  const { error } = await supabase.rpc("remove_team_member", { p_team: team.team.id, p_user: parsed.data.userId })
  if (error) return err(error.message)
  revalidatePath("/", "layout")
  return ok(null)
}

/* ─── Model settings (admin) ───────────────────────────────────────────── */

const MODEL_IDS = new Set(MODELS.map((m) => m.id))

const SettingsInput = z.object({
  disabledModels: z.array(z.string()).max(200),
  defaultModels: z.object({ image: z.string().optional(), video: z.string().optional() }),
  modelCosts: z.record(z.string(), z.object({ perRun: z.unknown().optional(), perSecond: z.unknown().optional() })),
  markupPercent: z.number().min(0).max(1000),
})

export async function saveTeamSettings(input: unknown): Promise<ActionResult> {
  const team = await requireAdmin()
  if (typeof team === "string") return err(team)
  const parsed = SettingsInput.safeParse(input)
  if (!parsed.success) return err("Invalid settings.")
  const disabled = [...new Set(parsed.data.disabledModels.filter((id) => MODEL_IDS.has(id)))]
  for (const surface of ["image", "video"] as const) {
    const enabled = MODELS.filter((m) => m.surface === surface && !disabled.includes(m.id))
    if (!enabled.length) return err(`Keep at least one ${surface} model enabled.`)
  }
  const defaults: Record<string, string> = {}
  for (const surface of ["image", "video"] as const) {
    const id = parsed.data.defaultModels[surface]
    if (id && MODELS.some((m) => m.id === id && m.surface === surface) && !disabled.includes(id)) defaults[surface] = id
  }
  const supabase = await createClient()
  const { error } = await supabase.from("team_settings").upsert({
    team_id: team.team.id,
    disabled_models: disabled,
    default_models: defaults,
    model_costs: sanitizeCosts(parsed.data.modelCosts, MODEL_IDS),
    markup_percent: parsed.data.markupPercent,
    updated_at: new Date().toISOString(),
  })
  if (error) return err(error.message)
  revalidatePath("/", "layout")
  return ok(null)
}
