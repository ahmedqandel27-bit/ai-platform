"use server"

import { z } from "zod"

import { getTeamContext } from "@/lib/team/server"
import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/team/actions"

export type UsageRow = {
  day: string
  userId: string
  email: string | null
  model: string
  projectId: string | null
  projectName: string | null
  jobs: number
  failed: number
  credits: number
}

export type UsageReport = {
  rows: UsageRow[]
  since: string
  /** Owners/admins see the whole team; members see their own usage. */
  scope: "team" | "self"
  monthlyBudget: number | null
  monthSpent: number
  todaySpent: number
  dailyCap: number | null
  costsConfigured: boolean
  markupPercent: number
}

export async function getUsage(input: unknown): Promise<ActionResult<UsageReport | null>> {
  const parsed = z.object({ days: z.number().int().min(1).max(365) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid range." }
  const team = await getTeamContext()
  if (!team) return { ok: true, data: null }
  const since = new Date(Date.now() - parsed.data.days * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("team_usage", { p_team: team.team.id, p_since: since.toISOString() })
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      rows: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        day: String(r.day),
        userId: r.user_id as string,
        email: (r.email as string | null) ?? null,
        model: r.model_id as string,
        projectId: (r.project_id as string | null) ?? null,
        projectName: (r.project_name as string | null) ?? null,
        jobs: Number(r.jobs),
        failed: Number(r.failed),
        credits: Number(r.credits),
      })),
      since: since.toISOString().slice(0, 10),
      scope: team.isAdmin ? "team" : "self",
      monthlyBudget: team.team.monthlyBudget,
      monthSpent: team.spend.monthSpent,
      todaySpent: team.spend.todaySpent,
      dailyCap: team.spend.dailyCap,
      costsConfigured: Object.keys(team.settings.modelCosts).length > 0,
      markupPercent: team.settings.markupPercent,
    },
  }
}
