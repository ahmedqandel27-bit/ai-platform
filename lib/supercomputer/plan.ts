import { MODELS, getModel, parseSettings } from "@/generation/catalog"
import type { GenerationPlane, MediaRole, ModelEntry, SettingField, Surface } from "@/generation/catalog/types"
import { toPlatform } from "@/generation/to-platform"
import type { PlanDraft } from "./plan-schema"

/** Validated, executable plan (what the cards render and the runner executes). */
export type Ref = { type: "step"; id: string } | { type: "upload"; index: number }
export type StepTool = "generate_image" | "generate_video" | "write_script"

export type PlanStep = {
  id: string
  tool: StepTool
  title: string
  /** Resolved catalog id ("" for write_script). */
  model: string
  /** True when the model was picked automatically (the card shows "Auto"). */
  auto: boolean
  prompt: string
  settings: Record<string, unknown>
  startFrame: Ref | null
  endFrame: Ref | null
  references: Ref[]
}

export type Plan = { title: string; steps: PlanStep[] }

export type UploadInfo = { url: string; kind: "image" | "video" | "audio" }

export const MAX_STEPS = 8

export function surfaceOf(tool: StepTool): Surface | null {
  return tool === "generate_image" ? "image" : tool === "generate_video" ? "video" : null
}

export function parseRef(value: string): Ref | null {
  const step = /^step:([A-Za-z0-9_-]{1,32})$/.exec(value.trim())
  if (step) return { type: "step", id: step[1]! }
  const upload = /^upload:(\d{1,2})$/.exec(value.trim())
  if (upload) return { type: "upload", index: Number(upload[1]) }
  return null
}

const DUMMY = "https://example.invalid/input"

/** Can `model` accept a plan step with these inputs? Uses the real catalog mapper. */
export function accepts(model: ModelEntry, needs: { start: boolean; end: boolean; refs: number }, prompt = "x"): boolean {
  const media: GenerationPlane["media"] = {}
  const add = (role: MediaRole, n: number) => {
    if (n > 0) media[role] = Array.from({ length: n }, (_, i) => ({ id: `${role}${i}`, role, kind: "image" as const, url: `${DUMMY}/${role}${i}` }))
  }
  add("start", needs.start ? 1 : 0)
  add("end", needs.end ? 1 : 0)
  add("reference", needs.refs)
  // Same rule as the studios: the input mode follows the attachments (none → no mode).
  const inputMode =
    needs.start || needs.end
      ? model.mediaModes?.find((m) => m.roles.start)?.id
      : needs.refs
        ? model.mediaModes?.find((m) => m.roles.reference)?.id
        : undefined
  try {
    toPlatform({ model: model.id, ...(inputMode ? { inputMode } : {}), prompt: { text: prompt }, media, settings: parseSettings(model, {}) })
    return true
  } catch {
    return false
  }
}

/** "Auto" mode: first model in catalog order (curated best-first) that fits the inputs. */
export function autoPick(surface: Surface, needs: { start: boolean; end: boolean; refs: number }): ModelEntry | null {
  const candidates = MODELS.filter((m) => m.surface === surface)
  return (
    candidates.find((m) => accepts(m, needs)) ??
    // Fewer references than asked is better than no model at all.
    (needs.refs > 1 ? candidates.find((m) => accepts(m, { ...needs, refs: 1 })) : undefined) ??
    null
  )
}

/** Coerces LLM key/value strings into valid catalog settings (invalid → default). */
export function coerceSettings(model: ModelEntry, pairs: Array<{ key: string; value: string }> | Record<string, unknown>): Record<string, unknown> {
  const raw: Record<string, unknown> = Array.isArray(pairs)
    ? Object.fromEntries(pairs.map((p) => [p.key.trim(), p.value]))
    : { ...pairs }
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(model.settings)) {
    const coerced = coerceValue(field, raw[key])
    if (coerced !== undefined) out[key] = coerced
  }
  return parseSettings(model, out)
}

function coerceValue(field: SettingField, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined
  if (field.type === "boolean") {
    if (typeof value === "boolean") return value
    const v = String(value).toLowerCase()
    return v === "true" || v === "yes" || v === "on" ? true : v === "false" || v === "no" || v === "off" ? false : undefined
  }
  if (field.type === "range") {
    const n = typeof value === "number" ? value : Number.parseFloat(String(value))
    if (!Number.isFinite(n)) return undefined
    const stepped = field.step ? Math.round(n / field.step) * field.step : Math.round(n)
    return Math.min(field.max, Math.max(field.min, stepped))
  }
  const v = String(value).trim()
  const match = field.values.find((option) => option.toLowerCase() === v.toLowerCase())
  return match ?? nearestAspect(field.values, v)
}

/** "4:5" on a model without 4:5 → the closest ratio it does offer (e.g. 3:4). */
function nearestAspect(values: readonly string[], wanted: string): string | undefined {
  const ratio = (s: string) => {
    const m = /^(\d+):(\d+)$/.exec(s)
    return m ? Number(m[1]) / Number(m[2]) : null
  }
  const target = ratio(wanted)
  if (target === null) return undefined
  let best: string | undefined
  let bestDiff = Infinity
  for (const option of values) {
    const r = ratio(option)
    if (r === null) continue
    const diff = Math.abs(Math.log(r / target))
    if (diff < bestDiff) {
      bestDiff = diff
      best = option
    }
  }
  return best
}

/**
 * Turns an untrusted LLM draft into an executable plan: known tools only,
 * catalog models only (else Auto), inputs that point at earlier image steps
 * or real uploads, settings within the model's schema, at most MAX_STEPS.
 */
export function normalizePlan(draft: PlanDraft, uploads: UploadInfo[]): Plan {
  const steps: PlanStep[] = []
  const imageSteps = new Set<string>()
  const usedIds = new Set<string>()

  for (const raw of draft.steps.slice(0, MAX_STEPS)) {
    let id = raw.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || `s${steps.length + 1}`
    while (usedIds.has(id)) id = `${id}_${steps.length + 1}`
    usedIds.add(id)

    const tool = raw.tool
    const title = raw.title.trim().slice(0, 80) || tool
    const prompt = raw.prompt.trim().slice(0, 5000)
    const surface = surfaceOf(tool)

    if (!surface) {
      steps.push({ id, tool, title, model: "", auto: false, prompt, settings: {}, startFrame: null, endFrame: null, references: [] })
      continue
    }

    const valid = (value: string): Ref | null => {
      const ref = parseRef(value)
      if (!ref) return null
      if (ref.type === "step") return imageSteps.has(ref.id) ? ref : null
      return uploads[ref.index]?.kind === "image" ? ref : null
    }

    let startFrame = surface === "video" ? valid(raw.start_frame) : null
    let endFrame = surface === "video" && startFrame ? valid(raw.end_frame) : null
    let references = raw.references.map(valid).filter((r): r is Ref => r !== null)
    // Image steps take everything as references.
    if (surface === "image") {
      const asRef = [raw.start_frame, raw.end_frame].map(valid).filter((r): r is Ref => r !== null)
      references = [...asRef, ...references]
    }
    // Frames and references do not mix on video models: frames win.
    if (surface === "video" && startFrame) references = []
    references = dedupeRefs(references)

    const needs = { start: Boolean(startFrame), end: Boolean(endFrame), refs: references.length }
    let model: ModelEntry | null = null
    let auto = true
    const requested = raw.model.trim()
    if (requested && requested !== "auto") {
      const found = MODELS.find((m) => m.id === requested && m.surface === surface)
      if (found && accepts(found, needs, prompt || "x")) {
        model = found
        auto = false
      }
    }
    model ??= autoPick(surface, needs)
    if (!model && endFrame) {
      endFrame = null
      model = autoPick(surface, { ...needs, end: false })
    }
    if (!model) continue

    const refCap = model.roles.reference ?? 0
    references = references.slice(0, refCap)
    if (!model.roles.start) startFrame = null
    if (!model.roles.end) endFrame = null

    steps.push({
      id,
      tool,
      title,
      model: model.id,
      auto,
      prompt,
      settings: coerceSettings(model, raw.settings),
      startFrame,
      endFrame,
      references,
    })
    if (surface === "image") imageSteps.add(id)
  }

  return { title: draft.title.trim().slice(0, 120), steps }
}

function dedupeRefs(refs: Ref[]): Ref[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = ref.type === "step" ? `s:${ref.id}` : `u:${ref.index}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Re-validates a step after the user edits it on the card (model switch, inputs). */
export function reconcileStep(step: PlanStep, modelId: string | "auto"): PlanStep {
  const surface = surfaceOf(step.tool)
  if (!surface) return step
  const needs = { start: Boolean(step.startFrame), end: Boolean(step.endFrame), refs: step.references.length }
  const explicit = modelId === "auto" ? undefined : MODELS.find((m) => m.id === modelId && m.surface === surface)
  // Unknown or removed model ids fall back to Auto.
  const picked = explicit ?? autoPick(surface, needs)
  if (!picked) return step
  return {
    ...step,
    model: picked.id,
    auto: !explicit,
    settings: coerceSettings(picked, step.settings),
    startFrame: picked.roles.start ? step.startFrame : null,
    endFrame: picked.roles.end ? step.endFrame : null,
    references: step.references.slice(0, picked.roles.reference ?? 0),
  }
}

export function modelLabel(id: string): string {
  try {
    return getModel(id).label
  } catch {
    return id
  }
}

/**
 * Re-validates a stored plan (recipes, persisted chats) against the current
 * catalog: unknown tools dropped, models re-resolved, settings coerced.
 */
export function sanitizePlan(value: unknown): Plan | null {
  if (!value || typeof value !== "object") return null
  const { title, steps } = value as { title?: unknown; steps?: unknown }
  if (!Array.isArray(steps)) return null
  const ids = new Set<string>()
  const out: PlanStep[] = []
  for (const raw of steps.slice(0, MAX_STEPS)) {
    if (!raw || typeof raw !== "object") continue
    const s = raw as Partial<PlanStep>
    if (s.tool !== "generate_image" && s.tool !== "generate_video" && s.tool !== "write_script") continue
    if (typeof s.id !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(s.id) || ids.has(s.id)) continue
    const refOk = (r: unknown): r is Ref =>
      !!r &&
      typeof r === "object" &&
      (((r as Ref).type === "step" && ids.has((r as { id: string }).id)) ||
        ((r as Ref).type === "upload" && Number.isInteger((r as { index: number }).index)))
    const step: PlanStep = {
      id: s.id,
      tool: s.tool,
      title: typeof s.title === "string" ? s.title.slice(0, 80) : s.tool,
      model: typeof s.model === "string" ? s.model : "",
      auto: s.auto !== false,
      prompt: typeof s.prompt === "string" ? s.prompt.slice(0, 5000) : "",
      settings: s.settings && typeof s.settings === "object" ? s.settings : {},
      startFrame: refOk(s.startFrame) ? s.startFrame : null,
      endFrame: refOk(s.endFrame) ? s.endFrame : null,
      references: Array.isArray(s.references) ? s.references.filter(refOk) : [],
    }
    out.push(step.tool === "write_script" ? step : reconcileStep(step, step.auto ? "auto" : step.model))
    ids.add(step.id)
  }
  return { title: typeof title === "string" ? title.slice(0, 120) : "", steps: out }
}

/** Ids of earlier steps this step consumes. */
export function dependencies(step: PlanStep): string[] {
  return [step.startFrame, step.endFrame, ...step.references]
    .filter((r): r is Extract<Ref, { type: "step" }> => r?.type === "step")
    .map((r) => r.id)
}
