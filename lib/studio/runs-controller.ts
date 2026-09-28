"use client"

import { cancelGeneration, deleteRun, listRuns, submitGeneration, type SubmitInput } from "@/generation/actions"
import type { GenerationError } from "@/generation/errors"
import { watchRequest, WatchError } from "@/generation/poll"
import { isTerminal, type Run } from "@/generation/run-types"
import { useKeyDialog } from "@/generation/stores/key-dialog"
import { useRunsStore } from "@/generation/stores/runs"

/**
 * The one controller for generations: submit → poll → settle, cancel, delete.
 * History lives in Supabase when configured; otherwise in this browser's
 * localStorage (`mode = "local"`). Failed and canceled runs stay visible.
 */

const LOCAL_KEY = "nexus-runs-v1"
const LOCAL_LIMIT = 300
let mode: "server" | "local" | null = null
let unsubscribeLocal: (() => void) | null = null

const store = () => useRunsStore.getState()

function onError(error: GenerationError) {
  if (error.code === "missing_key") useKeyDialog.getState().setOpen(true)
  else if (error.code === "invalid_key") useKeyDialog.getState().reject(error.message)
}

/** Loads history once and resumes polling for anything still running. */
export async function bootstrapRuns(): Promise<void> {
  if (mode) return
  const result = await listRuns()
  if (result.ok && result.data) {
    mode = "server"
    store().setAll(result.data)
  } else {
    mode = "local"
    store().setAll(readLocal())
    unsubscribeLocal = useRunsStore.subscribe((state) => writeLocal(state.runs))
  }

  for (const run of store().runs) {
    if (isTerminal(run.status)) continue
    if (run.requestId) watch(run.id, run.requestId)
    else
      // The page closed mid-submit: we cannot know whether the POST landed.
      store().patch(run.id, {
        status: "error",
        error: {
          code: "submit_unknown",
          message: "The page closed while submitting. Check your history on open.higgsfield.ai before generating again.",
        },
      })
  }
}

export function teardownRuns() {
  unsubscribeLocal?.()
  unsubscribeLocal = null
  mode = null
}

export async function submitRun(input: Omit<SubmitInput, "id">): Promise<Run> {
  const { projectId, ...rest } = input
  const run: Run = {
    ...rest,
    ...(projectId ? { projectId } : {}),
    id: crypto.randomUUID(),
    status: "submitting",
    createdAt: Date.now(),
  }
  store().upsert(run)

  let result: Awaited<ReturnType<typeof submitGeneration>>
  try {
    result = await submitGeneration({ ...input, id: run.id })
  } catch {
    // Network failure around the server action: the POST may have gone out.
    result = {
      ok: false,
      error: {
        code: "submit_unknown",
        message: "Connection lost while submitting. Check your history before generating again.",
      },
    }
  }

  if (!result.ok) {
    store().patch(run.id, { status: "error", error: result.error, finishedAt: Date.now() })
    onError(result.error)
    return { ...run, status: "error", error: result.error }
  }
  if ("duplicate" in result.data) {
    store().upsert(result.data.duplicate)
    return result.data.duplicate
  }
  const { requestId, status } = result.data
  store().patch(run.id, { requestId, status })
  if (!isTerminal(status)) watch(run.id, requestId)
  return { ...run, requestId, status }
}

function watch(id: string, requestId: string) {
  watchRequest(requestId, {
    onProgress: (status) => {
      if (store().runs.find((r) => r.id === id)?.status !== status) store().patch(id, { status })
    },
  })
    .then((entry) => {
      store().patch(id, {
        status: entry.status,
        ...(entry.outputs ? { outputs: entry.outputs } : {}),
        ...(entry.error ? { error: entry.error } : {}),
        finishedAt: Date.now(),
      })
    })
    .catch((caught: unknown) => {
      const error: GenerationError =
        caught instanceof WatchError
          ? caught.error
          : { code: "platform_error", message: caught instanceof Error ? caught.message : String(caught) }
      store().patch(id, { status: "error", error, finishedAt: Date.now() })
      onError(error)
    })
}

/** Cancel reaches the platform; the poller then observes `canceled`. */
export async function cancelRun(run: Run): Promise<GenerationError | null> {
  if (!run.requestId) return null
  const result = await cancelGeneration({ requestId: run.requestId })
  if (!result.ok) return result.error
  // Show it immediately; the next poll confirms the terminal status.
  store().patch(run.id, { status: "canceled", finishedAt: Date.now() })
  return null
}

export async function removeRun(run: Run) {
  store().remove(run.id)
  if (mode === "server") await deleteRun({ id: run.id })
}

function readLocal(): Run[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as Run[]) : []
  } catch {
    return []
  }
}

function writeLocal(runs: Run[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(runs.slice(0, LOCAL_LIMIT)))
  } catch {
    // Storage full or blocked: history just won't survive a reload.
  }
}
