import "server-only"

import { cookies } from "next/headers"

import { MODELS } from "@/generation/catalog"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { sanitizeCosts } from "./cost"
import { EMPTY_SETTINGS, type TeamContext, type TeamRole, type TeamSettings, type TeamSummary } from "./types"

export const TEAM_COOKIE = "nexus_team"

type Membership = { team_id: string; role: TeamRole; created_at: string; teams: { name: string; monthly_budget: number | null } | null }

/**
 * The active team: the one chosen in the switcher (cookie) if the user still
 * belongs to it, else the team they joined most recently (an agency invite
 * wins over the personal team created at sign-up). `null` in preview mode.
 */
export async function getTeamContext(): Promise<TeamContext | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("team_members")
    .select("team_id, role, created_at, teams(name, monthly_budget)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  const memberships = ((data ?? []) as unknown as Membership[]).filter((m) => m.teams)
  if (!memberships.length) return null

  const chosen = (await cookies()).get(TEAM_COOKIE)?.value
  const active = memberships.find((m) => m.team_id === chosen) ?? memberships[0]!

  const [{ data: settingsRow }, { data: spendRows }] = await Promise.all([
    supabase.from("team_settings").select("*").eq("team_id", active.team_id).maybeSingle(),
    supabase.rpc("spend_status", { p_team: active.team_id }),
  ])
  const spend = (spendRows as Array<{ month_spent: number; today_spent: number; daily_cap: number | null }> | null)?.[0]

  const teams: TeamSummary[] = memberships.map((m) => ({ id: m.team_id, name: m.teams!.name, role: m.role }))
  return {
    team: {
      id: active.team_id,
      name: active.teams!.name,
      role: active.role,
      monthlyBudget: active.teams!.monthly_budget === null ? null : Number(active.teams!.monthly_budget),
    },
    teams,
    settings: rowToSettings(settingsRow),
    isAdmin: active.role === "owner" || active.role === "admin",
    userId: user.id,
    spend: {
      monthSpent: Number(spend?.month_spent ?? 0),
      todaySpent: Number(spend?.today_spent ?? 0),
      dailyCap: spend?.daily_cap === null || spend?.daily_cap === undefined ? null : Number(spend.daily_cap),
    },
  }
}

const MODEL_IDS = new Set(MODELS.map((m) => m.id))

export function rowToSettings(row: Record<string, unknown> | null | undefined): TeamSettings {
  if (!row) return EMPTY_SETTINGS
  const defaults = (row.default_models ?? {}) as Record<string, unknown>
  const pick = (surface: "image" | "video") => {
    const id = defaults[surface]
    return typeof id === "string" && MODELS.some((m) => m.id === id && m.surface === surface) ? id : undefined
  }
  const image = pick("image")
  const video = pick("video")
  return {
    disabledModels: ((row.disabled_models as string[] | null) ?? []).filter((id) => MODEL_IDS.has(id)),
    defaultModels: { ...(image ? { image } : {}), ...(video ? { video } : {}) },
    modelCosts: sanitizeCosts(row.model_costs, MODEL_IDS),
    markupPercent: Number(row.markup_percent ?? 0),
  }
}
