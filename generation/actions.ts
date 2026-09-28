"use server"

import { cookies } from "next/headers"
import { after } from "next/server"

import { isSupabaseConfigured } from "@/lib/env"
import { getModel, parseSettings } from "./catalog"
import type { MediaItem, Surface } from "./catalog/types"
import {
  PLATFORM_KEY_COOKIE,
  PLATFORM_KEY_COOKIE_OPTIONS,
  encodeCredentials,
  parseCredentialInput,
} from "./credentials"
import { fail, toGenerationError, type GenerationError, type Result } from "./errors"
import * as jobs from "./jobs-repo"
import { createPlatformClient, PlatformError, type GenerationStatus } from "./platform"
import { isTerminal, planeFromRun, type Run, type RunOutputs, type RunStatus } from "./run-types"
import { getViewer, readUserKey, resolveCredentials, teamKeyAvailable, type Viewer } from "./server-credentials"
import { copyOutputsToStorage } from "./storage-copy"
import { toPlatform } from "./to-platform"

/* ─── API key (Connect / Replace / Remove) ─────────────────────────────── */

/** Stores the pasted key in an httpOnly cookie. Never returned, never logged. */
export async function saveApiKey(data: unknown): Promise<Result<null>> {
  try {
    const { apiKey } = parseCredentialInput(data)
    const jar = await cookies()
    jar.set(PLATFORM_KEY_COOKIE, encodeCredentials(apiKey), PLATFORM_KEY_COOKIE_OPTIONS)
    return { ok: true, data: null }
  } catch (caught) {
    return fail("invalid_input", caught instanceof Error ? caught.message : "Enter an API key")
  }
}

export async function removeApiKey(): Promise<Result<null>> {
  const jar = await cookies()
  jar.set(PLATFORM_KEY_COOKIE, "", { ...PLATFORM_KEY_COOKIE_OPTIONS, maxAge: 0 })
  return { ok: true, data: null }
}

/** `userKey`: a key is saved in this browser (saving alone does not prove it is valid). */
export async function getKeyStatus(): Promise<{ userKey: boolean; teamKey: boolean }> {
  const viewer = await getViewer()
  return { userKey: (await readUserKey()) !== null, teamKey: teamKeyAvailable(viewer) }
}

/* ─── Guards ───────────────────────────────────────────────────────────── */

const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/
const MAX_PROMPT = 5000
const SUBMITS_PER_MINUTE = 30

/** Per-instance guards. The database unique constraint is the durable one. */
const inflightSubmits = new Map<string, Promise<Result<SubmitData>>>()
const submitLog = new Map<string, number[]>()

function ownerKey(viewer: Viewer) {
  return viewer.userId ?? "preview"
}

function rateLimited(owner: string): boolean {
  const now = Date.now()
  const recent = (submitLog.get(owner) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= SUBMITS_PER_MINUTE) return true
  recent.push(now)
  submitLog.set(owner, recent)
  return false
}

/* ─── Submit ───────────────────────────────────────────────────────────── */

export type SubmitInput = {
  id: string
  surface: Surface
  model: string
  prompt: string
  settings: Record<string, unknown>
  media: MediaItem[]
  inputMode?: string
}

export type SubmitData = { requestId: string; status: RunStatus } | { duplicate: Run }

export async function submitGeneration(input: SubmitInput): Promise<Result<SubmitData>> {
  const viewer = await getViewer()
  if (!viewer) return fail("unauthenticated", "Sign in to generate.")
  if (!input || typeof input.id !== "string" || !CLIENT_ID.test(input.id))
    return fail("invalid_input", "Invalid request.")

  const key = `${ownerKey(viewer)}:${input.id}`
  const pending = inflightSubmits.get(key)
  if (pending) return pending

  const promise = doSubmit(viewer, input)
  inflightSubmits.set(key, promise)
  setTimeout(() => inflightSubmits.delete(key), 10 * 60_000)
  return promise
}

async function doSubmit(viewer: Viewer, input: SubmitInput): Promise<Result<SubmitData>> {
  // 1. Validate everything against the catalog before any paid call.
  let path: string
  let body: Record<string, unknown>
  let settings: Record<string, unknown>
  try {
    const model = getModel(input.model)
    if (model.surface !== input.surface) throw new Error("Model does not match this studio.")
    if (typeof input.prompt !== "string" || input.prompt.length > MAX_PROMPT)
      throw new Error(`Prompt must be under ${MAX_PROMPT} characters.`)
    if (!Array.isArray(input.media)) throw new Error("Invalid media inputs.")
    settings = parseSettings(model, input.settings ?? {})
    ;({ path, body } = toPlatform(planeFromRun({ ...input, settings })))
  } catch (caught) {
    return { ok: false, error: toGenerationError(caught) }
  }

  if (rateLimited(ownerKey(viewer)))
    return fail("rate_limited", "Too many generations in a minute. Wait a moment and try again.")

  let credentials: Awaited<ReturnType<typeof resolveCredentials>>
  try {
    credentials = await resolveCredentials(viewer)
  } catch (caught) {
    return { ok: false, error: toGenerationError(caught) }
  }

  // 2. Record ownership + idempotency before the paid POST.
  let jobId: string | null = null
  if (viewer.userId) {
    try {
      const inserted = await jobs.insertPendingJob({
        userId: viewer.userId,
        clientId: input.id,
        surface: input.surface,
        model: input.model,
        prompt: input.prompt,
        settings,
        media: input.media,
        ...(input.inputMode ? { inputMode: input.inputMode } : {}),
        platformPath: path,
      })
      if ("duplicate" in inserted) return { ok: true, data: { duplicate: inserted.duplicate } }
      jobId = inserted.jobId
    } catch (caught) {
      return fail("platform_error", caught instanceof Error ? caught.message : "Could not record the generation.")
    }
  }

  // 3. Submit exactly once. No automatic retry: a timed-out POST may still
  //    have been accepted (and billed) by the platform.
  try {
    const queued = await createPlatformClient(credentials).submit(path, body)
    if (jobId) await jobs.attachRequestId(jobId, queued.requestId, normalizeStatus(queued.status))
    return { ok: true, data: { requestId: queued.requestId, status: normalizeStatus(queued.status) } }
  } catch (caught) {
    // Only an HTTP answer from Higgsfield proves the request was rejected.
    // Anything else (network drop, timeout) is ambiguous: never auto-retry.
    const error: GenerationError =
      caught instanceof PlatformError
        ? toGenerationError(caught)
        : {
            code: "submit_unknown",
            message:
              "The request may or may not have reached Higgsfield. Check your history on open.higgsfield.ai before generating again.",
          }
    if (jobId) await jobs.markJobError(jobId, error)
    return { ok: false, error }
  }
}

/* ─── Status (batched) ─────────────────────────────────────────────────── */

export type StatusEntry =
  | { requestId: string; status: RunStatus; outputs?: RunOutputs; error?: GenerationError }
  | { requestId: string; failure: GenerationError }

/**
 * Every request in flight answered in one round trip (Next runs server
 * actions one at a time per client, so per-run polling would block submits).
 */
export async function getGenerationStatuses(data: { requestIds: string[] }): Promise<Result<StatusEntry[]>> {
  const viewer = await getViewer()
  if (!viewer) return fail("unauthenticated", "Sign in to continue.")
  const requestIds = parseRequestIds(data?.requestIds)
  if (!requestIds) return fail("invalid_input", "Invalid request ids.")

  let credentials: Awaited<ReturnType<typeof resolveCredentials>>
  try {
    credentials = await resolveCredentials(viewer)
  } catch (caught) {
    return { ok: false, error: toGenerationError(caught) }
  }

  const owned = viewer.userId ? await jobs.ownedRequestIds(requestIds) : null
  const client = createPlatformClient(credentials)

  const entries = await Promise.all(
    requestIds.map(async (requestId): Promise<StatusEntry> => {
      if (owned && !owned.has(requestId))
        return { requestId, failure: { code: "not_found", message: "Generation not found." } }
      try {
        const entry = fromPlatformStatus(requestId, await client.status(requestId))
        if (viewer.userId) {
          const terminal = isTerminal(entry.status)
          const { firstCompletion } = await jobs.recordStatus(
            requestId,
            entry.status,
            entry.outputs,
            entry.error,
            terminal,
          )
          if (firstCompletion && entry.outputs) {
            const outputs = entry.outputs
            after(() => copyOutputsToStorage(firstCompletion.jobId, firstCompletion.userId, outputs))
          }
        }
        return entry
      } catch (caught) {
        return { requestId, failure: toGenerationError(caught) }
      }
    }),
  )
  return { ok: true, data: entries }
}

function fromPlatformStatus(
  requestId: string,
  status: GenerationStatus,
): Extract<StatusEntry, { status: RunStatus }> {
  const normalized = normalizeStatus(status.status)
  const outputs: RunOutputs | undefined =
    status.video || status.images ? { ...(status.video ? { video: status.video } : {}), ...(status.images ? { images: status.images } : {}) } : undefined
  let error: GenerationError | undefined
  if (normalized === "nsfw")
    error = { code: "content_blocked", message: "Blocked by the content filter. Rephrase the prompt or change the references." }
  else if (normalized === "failed")
    error = { code: "platform_error", message: describe(status.error) ?? "The generation failed on Higgsfield." }
  return { requestId, status: normalized, ...(outputs ? { outputs } : {}), ...(error ? { error } : {}) }
}

function normalizeStatus(status: string): RunStatus {
  switch (status) {
    case "completed":
    case "failed":
    case "nsfw":
    case "canceled":
    case "queued":
    case "in_progress":
      return status
    case "cancelled":
      return "canceled"
    default:
      return "in_progress"
  }
}

function describe(error: unknown): string | undefined {
  if (typeof error === "string" && error) return error
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    for (const key of ["detail", "message", "error"])
      if (typeof record[key] === "string" && record[key]) return record[key] as string
  }
  return undefined
}

/* ─── Cancel ───────────────────────────────────────────────────────────── */

/** Reaches the platform cancel endpoint (stopping polling alone does not cancel). */
export async function cancelGeneration(data: { requestId: string }): Promise<Result<null>> {
  const viewer = await getViewer()
  if (!viewer) return fail("unauthenticated", "Sign in to continue.")
  const [requestId] = parseRequestIds([data?.requestId]) ?? []
  if (!requestId) return fail("invalid_input", "Invalid request id.")
  if (viewer.userId && !(await jobs.ownedRequestIds([requestId])).has(requestId))
    return fail("not_found", "Generation not found.")
  try {
    await createPlatformClient(await resolveCredentials(viewer)).cancel(requestId)
    return { ok: true, data: null }
  } catch (caught) {
    const error = toGenerationError(caught)
    // The platform only cancels queued requests; a started one keeps running.
    if (error.code === "invalid_input")
      return fail("invalid_input", "This generation has already started and can no longer be canceled.")
    return { ok: false, error }
  }
}

/* ─── History ──────────────────────────────────────────────────────────── */

/** Server history when Supabase is configured; `null` means "use browser-local history". */
export async function listRuns(): Promise<Result<Run[] | null>> {
  if (!isSupabaseConfigured) return { ok: true, data: null }
  const viewer = await getViewer()
  if (!viewer?.userId) return fail("unauthenticated", "Sign in to continue.")
  try {
    return { ok: true, data: await jobs.listJobs() }
  } catch (caught) {
    return fail("platform_error", caught instanceof Error ? caught.message : "Could not load history.")
  }
}

export async function deleteRun(data: { id: string }): Promise<Result<null>> {
  if (!isSupabaseConfigured) return { ok: true, data: null }
  const viewer = await getViewer()
  if (!viewer?.userId) return fail("unauthenticated", "Sign in to continue.")
  if (typeof data?.id !== "string" || !CLIENT_ID.test(data.id)) return fail("invalid_input", "Invalid id.")
  await jobs.deleteJob(data.id)
  return { ok: true, data: null }
}

function parseRequestIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null
  const ids = value.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id))
  return ids.length === value.length ? ids : null
}
