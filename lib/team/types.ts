import type { ModelCosts } from "./cost"

export type TeamRole = "owner" | "admin" | "member"

export type TeamSettings = {
  disabledModels: string[]
  defaultModels: { image?: string; video?: string }
  modelCosts: ModelCosts
  markupPercent: number
}

export const EMPTY_SETTINGS: TeamSettings = { disabledModels: [], defaultModels: {}, modelCosts: {}, markupPercent: 0 }

export type TeamSummary = { id: string; name: string; role: TeamRole }

/** Everything the UI needs about the active team. `null` in preview mode. */
export type TeamContext = {
  team: TeamSummary & { monthlyBudget: number | null }
  teams: TeamSummary[]
  settings: TeamSettings
  isAdmin: boolean
  userId: string
  spend: { monthSpent: number; todaySpent: number; dailyCap: number | null }
}
