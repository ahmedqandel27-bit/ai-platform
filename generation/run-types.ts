import type { GenerationPlane, MediaItem, Surface } from "./catalog/types"
import type { GenerationError } from "./errors"

/** Platform statuses that never change again. */
export const TERMINAL_STATUSES = ["completed", "failed", "nsfw", "canceled"] as const
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number]

/**
 * Client-visible lifecycle of one generation.
 * - `submitting`: POST in flight (no request id yet)
 * - `queued` / `in_progress`: platform statuses while polling
 * - `error`: never reached the platform, or its result could not be read
 */
export type RunStatus = "submitting" | "queued" | "in_progress" | TerminalStatus | "error"

export type RunOutputs = { images?: Array<{ url: string }>; video?: { url: string } }

export type Run = {
  /** Client id; doubles as the server idempotency key for the submit. */
  id: string
  requestId?: string
  surface: Surface
  model: string
  prompt: string
  settings: Record<string, unknown>
  media: MediaItem[]
  inputMode?: string
  status: RunStatus
  outputs?: RunOutputs
  error?: GenerationError
  createdAt: number
  finishedAt?: number
}

export function isTerminal(status: RunStatus): boolean {
  return status === "error" || (TERMINAL_STATUSES as readonly string[]).includes(status)
}

export function planeFromRun(run: Pick<Run, "model" | "prompt" | "settings" | "media" | "inputMode">): GenerationPlane {
  const media: GenerationPlane["media"] = {}
  for (const item of run.media) (media[item.role] ??= []).push(item)
  return {
    model: run.model,
    ...(run.inputMode ? { inputMode: run.inputMode } : {}),
    prompt: { text: run.prompt },
    media,
    settings: run.settings,
  }
}
