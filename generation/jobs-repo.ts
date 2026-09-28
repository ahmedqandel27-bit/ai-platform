import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { MediaItem, Surface } from "./catalog/types"
import type { GenerationError } from "./errors"
import type { Run, RunOutputs, RunStatus } from "./run-types"

/**
 * Persistence for generations in Supabase (`public.jobs`, RLS: owner only).
 * Every platform request id is stored with the user who created it; status,
 * results and cancel are only served for ids found here.
 */

type JobRow = {
  id: string
  client_id: string
  provider_request_id: string | null
  surface: Surface
  model_id: string
  prompt: string
  settings: Record<string, unknown>
  media: MediaItem[]
  input_mode: string | null
  project_id: string | null
  cost: number | null
  status: RunStatus
  outputs: RunOutputs | null
  storage_paths: string[] | null
  error: GenerationError | null
  created_at: string
  finished_at: string | null
}

const COLUMNS =
  "id, client_id, provider_request_id, surface, model_id, prompt, settings, media, input_mode, project_id, cost, status, outputs, storage_paths, error, created_at, finished_at"

export type NewJob = {
  userId: string
  clientId: string
  surface: Surface
  model: string
  prompt: string
  settings: Record<string, unknown>
  media: MediaItem[]
  inputMode?: string
  platformPath: string
  teamId: string | null
  projectId: string | null
  cost: number | null
}

/**
 * Inserts the job BEFORE calling the platform. The unique (user_id, client_id)
 * constraint makes a double-click or replayed action a no-op instead of a
 * second paid generation.
 */
export async function insertPendingJob(job: NewJob): Promise<{ jobId: string } | { duplicate: Run }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: job.userId,
      client_id: job.clientId,
      surface: job.surface,
      model_id: job.model,
      prompt: job.prompt,
      settings: job.settings,
      media: job.media,
      input_mode: job.inputMode ?? null,
      platform_path: job.platformPath,
      team_id: job.teamId,
      project_id: job.projectId,
      cost: job.cost,
      status: "submitting",
    })
    .select("id")
    .single()

  if (!error && data) return { jobId: data.id as string }
  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("jobs")
      .select(COLUMNS)
      .eq("client_id", job.clientId)
      .eq("user_id", job.userId)
      .single()
    if (existing) return { duplicate: rowToRun(existing as JobRow) }
  }
  throw new Error(error?.message ?? "Could not record the generation")
}

export async function attachRequestId(jobId: string, requestId: string, status: string) {
  const supabase = await createClient()
  await supabase.from("jobs").update({ provider_request_id: requestId, status }).eq("id", jobId)
}

export async function markJobError(jobId: string, error: GenerationError) {
  const supabase = await createClient()
  await supabase
    .from("jobs")
    .update({ status: "error", error, finished_at: new Date().toISOString() })
    .eq("id", jobId)
}

/**
 * Returns the subset of request ids created by this user. Teammates can SEE
 * jobs in shared projects, but only the creator may poll or cancel them.
 */
export async function ownedRequestIds(userId: string, requestIds: string[]): Promise<Set<string>> {
  if (!requestIds.length) return new Set()
  const supabase = await createClient()
  const { data } = await supabase
    .from("jobs")
    .select("provider_request_id")
    .eq("user_id", userId)
    .in("provider_request_id", requestIds)
  return new Set((data ?? []).map((row) => row.provider_request_id as string))
}

/**
 * Records a status. Returns the job id the FIRST time a job becomes
 * `completed`, so the caller copies outputs to storage exactly once.
 */
export async function recordStatus(
  requestId: string,
  status: RunStatus,
  outputs: RunOutputs | undefined,
  error: GenerationError | undefined,
  terminal: boolean,
): Promise<{ firstCompletion: { jobId: string; userId: string } | null }> {
  const supabase = await createClient()
  const patch: Record<string, unknown> = { status }
  if (outputs) patch.outputs = outputs
  if (error) patch.error = error
  if (terminal) patch.finished_at = new Date().toISOString()

  const { data } = await supabase
    .from("jobs")
    .update(patch)
    .eq("provider_request_id", requestId)
    .neq("status", status)
    .select("id, user_id")
  const row = data?.[0]
  return {
    firstCompletion: status === "completed" && row ? { jobId: row.id as string, userId: row.user_id as string } : null,
  }
}

export async function saveStoragePaths(jobId: string, paths: string[]) {
  const supabase = await createClient()
  await supabase.from("jobs").update({ storage_paths: paths }).eq("id", jobId)
}

export async function deleteJob(userId: string, clientId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("jobs")
    .delete()
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .select("storage_paths")
  const paths = (data?.[0]?.storage_paths as string[] | null) ?? []
  if (paths.length) await supabase.storage.from(OUTPUTS_BUCKET).remove(paths)
}

export const OUTPUTS_BUCKET = "outputs"

/** Files (or unfiles) one of the user's jobs under a project of their team. */
export async function setJobProject(userId: string, clientId: string, projectId: string | null, teamId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("jobs")
    .update({ project_id: projectId, team_id: teamId })
    .eq("client_id", clientId)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

/** The user's own recent jobs; outputs copied to storage come back as 1-hour signed URLs. */
export async function listJobs(userId: string, limit = 200): Promise<Run[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("jobs")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return withSignedOutputs((data ?? []) as JobRow[])
}

/** Everything filed under a project, from every teammate (RLS: team members). */
export async function listProjectJobs(projectId: string, limit = 300): Promise<Run[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("jobs")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return withSignedOutputs((data ?? []) as JobRow[])
}

async function withSignedOutputs(rows: JobRow[]): Promise<Run[]> {
  const supabase = await createClient()

  const allPaths = rows.flatMap((row) => row.storage_paths ?? [])
  const signed = new Map<string, string>()
  if (allPaths.length) {
    const { data: urls } = await supabase.storage.from(OUTPUTS_BUCKET).createSignedUrls(allPaths, 60 * 60)
    for (const entry of urls ?? []) if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl)
  }

  return rows.map((row) => {
    const run = rowToRun(row)
    const stored = (row.storage_paths ?? []).map((p) => signed.get(p)).filter((u): u is string => Boolean(u))
    if (stored.length && run.outputs) {
      run.outputs = run.outputs.video ? { video: { url: stored[0]! } } : { images: stored.map((url) => ({ url })) }
    }
    return run
  })
}

function rowToRun(row: JobRow): Run {
  return {
    id: row.client_id,
    ...(row.provider_request_id ? { requestId: row.provider_request_id } : {}),
    surface: row.surface,
    model: row.model_id,
    prompt: row.prompt,
    settings: row.settings ?? {},
    media: row.media ?? [],
    ...(row.input_mode ? { inputMode: row.input_mode } : {}),
    ...(row.project_id ? { projectId: row.project_id } : {}),
    ...(row.cost !== null && row.cost !== undefined ? { cost: Number(row.cost) } : {}),
    status: row.status,
    ...(row.outputs ? { outputs: row.outputs } : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: Date.parse(row.created_at),
    ...(row.finished_at ? { finishedAt: Date.parse(row.finished_at) } : {}),
  }
}
