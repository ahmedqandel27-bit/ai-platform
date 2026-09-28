import { getGenerationStatuses, type StatusEntry } from "./actions"
import type { GenerationError } from "./errors"
import { isTerminal, type RunStatus } from "./run-types"

/**
 * Client-side batched poller (adapted from the Higgsfield Studio template).
 * Every request in flight is asked for together, in one server action per
 * interval: Next dispatches server actions one at a time per client, so a
 * poll per run would queue ahead of the next submit.
 */

export const POLL_INTERVAL_MS = 4000
const MAX_INTERVAL_MS = 20_000
export const POLL_DEADLINE_MS = 15 * 60_000
/** Rounds allowed to fail back to back before the watches are given up on. */
const MAX_MISSES = 4
/** Errors no retry can fix: fail every watch immediately. */
const FATAL = new Set(["missing_key", "invalid_key", "unauthenticated"])

export type Settled = Extract<StatusEntry, { status: RunStatus }>

export class WatchError extends Error {
  constructor(readonly error: GenerationError) {
    super(error.message)
  }
}

type Waiter = {
  deadline: number
  onProgress?: (status: RunStatus) => void
  resolve: (entry: Settled) => void
  reject: (reason: WatchError) => void
}

const waiting = new Map<string, Waiter>()
const inflight = new Map<string, Promise<Settled>>()
let timer: ReturnType<typeof setTimeout> | null = null
let polling = false
let misses = 0

/** Resolves when the platform reports a terminal status for this request. */
export function watchRequest(
  requestId: string,
  opts?: { deadline?: number; onProgress?: (status: RunStatus) => void },
): Promise<Settled> {
  const existing = inflight.get(requestId)
  if (existing) return existing
  const promise = new Promise<Settled>((resolve, reject) => {
    waiting.set(requestId, {
      deadline: opts?.deadline ?? Date.now() + POLL_DEADLINE_MS,
      ...(opts?.onProgress ? { onProgress: opts.onProgress } : {}),
      resolve: (entry) => {
        inflight.delete(requestId)
        resolve(entry)
      },
      reject: (reason) => {
        inflight.delete(requestId)
        reject(reason)
      },
    })
    schedule()
  })
  inflight.set(requestId, promise)
  return promise
}

/** Drops every watch without settling it (the app unmounted). */
export function stopWatching(): void {
  if (timer !== null) clearTimeout(timer)
  timer = null
  misses = 0
  waiting.clear()
  inflight.clear()
}

function schedule(): void {
  if (timer !== null || polling || waiting.size === 0) return
  // Back off while rounds keep failing (429 / network).
  const delay = Math.min(POLL_INTERVAL_MS * 2 ** misses, MAX_INTERVAL_MS)
  timer = setTimeout(() => void round(), delay)
}

async function round(): Promise<void> {
  timer = null
  polling = true
  try {
    const result = await getGenerationStatuses({ requestIds: [...waiting.keys()].slice(0, 50) })
    if (!result.ok) {
      if (FATAL.has(result.error.code)) return settleAll(result.error)
      if (++misses >= MAX_MISSES) settleAll(result.error)
      return
    }
    misses = 0
    for (const entry of result.data) deliver(entry)
    sweep()
  } catch (caught) {
    if (++misses >= MAX_MISSES)
      settleAll({ code: "platform_error", message: caught instanceof Error ? caught.message : String(caught) })
  } finally {
    polling = false
    schedule()
  }
}

function deliver(entry: StatusEntry): void {
  const waiter = waiting.get(entry.requestId)
  if (!waiter) return
  if ("failure" in entry) {
    // A rate-limited or flaky single status read is retried next round.
    if (entry.failure.code === "rate_limited" || entry.failure.code === "platform_error") return
    waiting.delete(entry.requestId)
    waiter.reject(new WatchError(entry.failure))
    return
  }
  if (!isTerminal(entry.status)) {
    waiter.onProgress?.(entry.status)
    return
  }
  waiting.delete(entry.requestId)
  waiter.resolve(entry)
}

/** A run the platform never finishes would otherwise spin forever. */
function sweep(): void {
  const now = Date.now()
  for (const [requestId, waiter] of [...waiting]) {
    if (now <= waiter.deadline) continue
    waiting.delete(requestId)
    waiter.reject(
      new WatchError({
        code: "timeout",
        message: "Still not finished after 15 minutes. It may complete later on Higgsfield.",
      }),
    )
  }
}

function settleAll(error: GenerationError): void {
  const waiters = [...waiting.values()]
  waiting.clear()
  misses = 0
  for (const waiter of waiters) waiter.reject(new WatchError(error))
}
