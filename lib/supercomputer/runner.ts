"use client"

import { getModel } from "@/generation/catalog"
import { inferInputMode } from "@/generation/catalog/media-inputs"
import type { MediaItem, MediaRole } from "@/generation/catalog/types"
import { isTerminal, type Run } from "@/generation/run-types"
import { useRunsStore } from "@/generation/stores/runs"
import { cancelRun, submitRun } from "@/lib/studio/runs-controller"
import { writeScript } from "./actions"
import { dependencies, surfaceOf, type Ref } from "./plan"
import { findMessage, useSuperComputer, type StepState } from "./store"

/**
 * Executes a plan card: every step whose inputs are ready starts at once
 * (image keyframes in parallel, then the videos that animate them). Steps
 * whose inputs failed are skipped. Generations go through the same
 * submit → poll → settle path as the studios, so they show up in the jobs
 * tray, the studios and the library, with the same duplicate protection.
 */

const active = new Set<string>()
const stopped = new Set<string>()
const key = (sessionId: string, messageId: string) => `${sessionId}:${messageId}`

export function isPlanRunning(sessionId: string, messageId: string) {
  return active.has(key(sessionId, messageId))
}

/** Runs every step that is not done yet (idle, failed or skipped ones are retried). */
export async function runPlan(sessionId: string, messageId: string, only?: string): Promise<void> {
  const k = key(sessionId, messageId)
  if (active.has(k)) return
  active.add(k)
  stopped.delete(k)
  const sc = useSuperComputer.getState()
  const plan = findMessage(sessionId, messageId)?.plan
  if (!plan) {
    active.delete(k)
    return
  }

  for (const step of plan.steps) {
    const retry = only ? step.id === only : step.status !== "done"
    if (retry && step.status !== "running") sc.patchStep(sessionId, messageId, step.id, { status: "idle", error: undefined })
  }
  sc.patchPlan(sessionId, messageId, { status: "running", scope: only })

  const inflight = new Map<string, Promise<void>>()
  const current = () => findMessage(sessionId, messageId)?.plan?.steps ?? []

  // Adopt generations already in flight (e.g. the page was reloaded mid-run).
  for (const step of current()) {
    if (step.status !== "running" || !step.runId) continue
    inflight.set(
      step.id,
      settleFromRun(sessionId, messageId, step.id, step.runId).finally(() => inflight.delete(step.id)),
    )
  }

  try {
    for (;;) {
      const steps = current()
      const byId = new Map(steps.map((s) => [s.id, s]))
      if (!stopped.has(k)) {
        for (const step of steps) {
          if (step.status !== "idle" || inflight.has(step.id)) continue
          if (only && step.id !== only) continue
          const deps = dependencies(step).map((id) => byId.get(id))
          if (deps.some((d) => !d || d.status === "failed" || d.status === "skipped")) {
            sc.patchStep(sessionId, messageId, step.id, { status: "skipped", error: "An input step did not finish." })
            continue
          }
          if (!deps.every((d) => d?.status === "done")) continue
          const job = executeStep(sessionId, messageId, step).finally(() => inflight.delete(step.id))
          inflight.set(step.id, job)
        }
      }
      if (inflight.size === 0) break
      await Promise.race(inflight.values())
    }
  } finally {
    active.delete(k)
    const steps = current()
    // Steps never reached (stopped, or waiting on an input that never came) go back to idle.
    for (const s of steps) if (s.status === "running" && !s.runId) sc.patchStep(sessionId, messageId, s.id, { status: "idle" })
    sc.patchPlan(sessionId, messageId, {
      status: steps.every((s) => s.status === "idle") ? "draft" : "finished",
      scope: undefined,
    })
  }
}

/** Stops scheduling new steps and cancels generations still queued on Higgsfield. */
export async function stopPlan(sessionId: string, messageId: string) {
  stopped.add(key(sessionId, messageId))
  const steps = findMessage(sessionId, messageId)?.plan?.steps ?? []
  const runs = useRunsStore.getState().runs
  await Promise.all(
    steps
      .filter((s) => s.status === "running" && s.runId)
      .map((s) => runs.find((r) => r.id === s.runId))
      .filter((r): r is Run => Boolean(r?.requestId) && !isTerminal(r!.status))
      .map((r) => cancelRun(r)),
  )
}

/**
 * After a reload: plans that were running continue where they stopped
 * (in-flight generations are re-adopted, never re-submitted); a lone step
 * retry is re-attached to its generation.
 */
export function resumeRunningSteps() {
  const sc = useSuperComputer.getState()
  for (const session of sc.sessions) {
    for (const message of session.messages) {
      const plan = message.plan
      if (!plan) continue
      for (const step of plan.steps)
        if (step.status === "running" && !step.runId) sc.patchStep(session.id, message.id, step.id, { status: "idle" })
      if (plan.status === "running") {
        void runPlan(session.id, message.id, plan.scope)
        continue
      }
      for (const step of plan.steps)
        if (step.status === "running" && step.runId) void settleFromRun(session.id, message.id, step.id, step.runId)
    }
  }
}

async function executeStep(sessionId: string, messageId: string, step: StepState): Promise<void> {
  const sc = useSuperComputer.getState()
  sc.patchStep(sessionId, messageId, step.id, { status: "running", error: undefined, runId: undefined })
  const message = findMessage(sessionId, messageId)
  const plan = message?.plan
  if (!plan) return

  if (step.tool === "write_script") {
    const context = plan.steps
      .filter((s) => s.id !== step.id && s.tool !== "write_script")
      .map((s) => `- ${s.title}: ${s.prompt}`)
      .join("\n")
    const result = await writeScript({ brief: step.prompt, context })
    sc.patchStep(sessionId, messageId, step.id, result.ok ? { status: "done", text: result.data.text } : { status: "failed", error: result.error.message })
    return
  }

  const surface = surfaceOf(step.tool)!
  const resolve = (ref: Ref | null): string | null => {
    if (!ref) return null
    if (ref.type === "upload") return plan.uploads[ref.index]?.url ?? null
    const source = plan.steps.find((s) => s.id === ref.id)
    return source?.outputs?.images?.[0] ?? null
  }

  const media: MediaItem[] = []
  const push = (role: MediaRole, url: string | null) => {
    if (url) media.push({ id: crypto.randomUUID(), url, role, kind: "image" })
  }
  push("start", resolve(step.startFrame))
  push("end", resolve(step.endFrame))
  for (const ref of step.references) push("reference", resolve(ref))

  let inputMode: string | undefined
  try {
    inputMode = inferInputMode(getModel(step.model), media)
  } catch {
    inputMode = undefined
  }

  const run = await submitRun({
    surface,
    model: step.model,
    prompt: step.prompt,
    settings: step.settings,
    media,
    ...(inputMode ? { inputMode } : {}),
  })
  sc.patchStep(sessionId, messageId, step.id, { runId: run.id })
  await settleFromRun(sessionId, messageId, step.id, run.id)
}

async function settleFromRun(sessionId: string, messageId: string, stepId: string, runId: string) {
  const run = await waitForRun(runId)
  const sc = useSuperComputer.getState()
  if (run?.status === "completed" && run.outputs) {
    sc.patchStep(sessionId, messageId, stepId, {
      status: "done",
      outputs: {
        ...(run.outputs.images ? { images: run.outputs.images.map((i) => i.url) } : {}),
        ...(run.outputs.video ? { video: run.outputs.video.url } : {}),
      },
    })
  } else {
    const canceled = run?.status === "canceled"
    sc.patchStep(sessionId, messageId, stepId, {
      status: canceled ? "skipped" : "failed",
      error: canceled ? "Canceled." : (run?.error?.message ?? "The generation did not finish."),
    })
  }
}

/** Resolves when the run reaches a terminal status (or disappears from history). */
export function waitForRun(runId: string): Promise<Run | null> {
  return new Promise((resolve) => {
    let unsubscribe: () => void = () => {}
    const check = () => {
      const { runs, hydrated } = useRunsStore.getState()
      const run = runs.find((r) => r.id === runId)
      if (!run && hydrated) {
        unsubscribe()
        resolve(null)
      } else if (run && isTerminal(run.status)) {
        unsubscribe()
        resolve(run)
      }
    }
    unsubscribe = useRunsStore.subscribe(check)
    check()
  })
}
