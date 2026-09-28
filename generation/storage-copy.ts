import "server-only"

import { createClient } from "@/lib/supabase/server"
import { OUTPUTS_BUCKET, saveStoragePaths } from "./jobs-repo"
import type { RunOutputs } from "./run-types"

const MAX_BYTES = 500 * 1024 * 1024

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

/**
 * Copies finished media from Higgsfield into the private `outputs` bucket
 * (`<user_id>/<job_id>/<n>.<ext>`) so history keeps working after the
 * platform's URLs expire. Best effort: on failure the platform URLs remain.
 */
export async function copyOutputsToStorage(jobId: string, userId: string, outputs: RunOutputs) {
  const urls = outputs.video ? [outputs.video.url] : (outputs.images ?? []).map((image) => image.url)
  if (!urls.length) return

  const supabase = await createClient()
  const paths: string[] = []

  for (const [index, url] of urls.entries()) {
    try {
      if (!url.startsWith("https://")) throw new Error("non-https output url")
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) throw new Error(`download failed (${response.status})`)
      const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim()
      const length = Number(response.headers.get("content-length") ?? 0)
      if (length > MAX_BYTES) throw new Error("output too large to copy")
      const bytes = await response.arrayBuffer()
      const ext = EXT[contentType] ?? (outputs.video ? "mp4" : "png")
      const path = `${userId}/${jobId}/${index}.${ext}`
      const { error } = await supabase.storage
        .from(OUTPUTS_BUCKET)
        .upload(path, bytes, { contentType: contentType || undefined, upsert: true })
      if (error) throw error
      paths.push(path)
    } catch (caught) {
      // Never log the media URL itself (it can carry signed query params).
      console.error("[storage-copy] could not copy output", {
        jobId,
        index,
        reason: caught instanceof Error ? caught.message : String(caught),
      })
      return
    }
  }

  await saveStoragePaths(jobId, paths)
}
