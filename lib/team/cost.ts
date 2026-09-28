import type { ModelEntry } from "@/generation/catalog/types"

/** Credits an admin assigned to a model (Higgsfield pricing is not fetched automatically). */
export type ModelCost = { perRun?: number; perSecond?: number }
export type ModelCosts = Record<string, ModelCost>

/**
 * Estimated credits for one generation, or null when no cost is configured
 * for the model. Video `perSecond` uses the `duration` setting; image batch
 * settings (`batchSize`) multiply the per-run price.
 */
export function estimateCost(model: ModelEntry, settings: Record<string, unknown>, costs: ModelCosts | undefined): number | null {
  const cost = costs?.[model.id]
  if (!cost || (cost.perRun === undefined && cost.perSecond === undefined)) return null
  const batch = Number(settings.batchSize ?? 1)
  const count = Number.isFinite(batch) && batch > 0 ? batch : 1
  const seconds = typeof settings.duration === "number" ? settings.duration : 0
  const total = (cost.perRun ?? 0) * count + (cost.perSecond ?? 0) * seconds
  return Math.round(total * 100) / 100
}

/** Validates admin input: non-negative finite numbers, known model ids only. */
export function sanitizeCosts(value: unknown, knownIds: Set<string>): ModelCosts {
  const out: ModelCosts = {}
  if (!value || typeof value !== "object") return out
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!knownIds.has(id) || !raw || typeof raw !== "object") continue
    const entry: ModelCost = {}
    for (const key of ["perRun", "perSecond"] as const) {
      const n = Number((raw as Record<string, unknown>)[key])
      if ((raw as Record<string, unknown>)[key] !== "" && (raw as Record<string, unknown>)[key] != null && Number.isFinite(n) && n >= 0 && n <= 1_000_000)
        entry[key] = Math.round(n * 100) / 100
    }
    if (entry.perRun !== undefined || entry.perSecond !== undefined) out[id] = entry
  }
  return out
}
