import { changeImageRole, ROLE_KIND } from "@/generation/catalog/media-inputs"
import type { MediaItem, MediaKind, MediaRole, ModelEntry } from "@/generation/catalog/types"

/** Roles a file of this kind can take, in the order we auto-assign them. */
const ROLE_PREFERENCE: Record<MediaKind, MediaRole[]> = {
  image: ["reference", "start", "end"],
  video: ["source", "video"],
  audio: ["audio"],
}

export function rolesForKind(model: ModelEntry, kind: MediaKind): MediaRole[] {
  return ROLE_PREFERENCE[kind].filter((role) => (model.roles[role] ?? 0) > 0)
}

export function acceptedKinds(model: ModelEntry): MediaKind[] {
  return (["image", "video", "audio"] as const).filter((kind) => rolesForKind(model, kind).length > 0)
}

export const ACCEPT: Record<MediaKind, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4",
  audio: "audio/wav,audio/x-wav",
}

/**
 * Adds one uploaded file, routing it to the first role with free capacity
 * (images: reference → start → end; videos: source → video reference).
 * Throws with a readable message when the model has no room for it.
 */
export function addMedia(model: ModelEntry, media: MediaItem[], item: Omit<MediaItem, "role"> & { kind: MediaKind }): MediaItem[] {
  if (media.some((m) => m.url === item.url)) return media
  const roles = rolesForKind(model, item.kind)
  if (!roles.length) throw new Error(`${model.label} does not accept ${item.kind} files.`)
  const role = roles.find((r) => media.filter((m) => m.role === r).length < (model.roles[r] ?? 0))
  if (!role) {
    const max = roles.reduce((sum, r) => sum + (model.roles[r] ?? 0), 0)
    throw new Error(`${model.label}: maximum ${max} ${item.kind} attachments.`)
  }
  return [...media, { ...item, role }]
}

/** Reassigns a role (frame ↔ reference, source ↔ video reference) with catalog caps enforced. */
export function setRole(model: ModelEntry, media: MediaItem[], id: string, role: MediaRole): MediaItem[] {
  if (role === "reference" || role === "start" || role === "end") return changeImageRole(model, media, id, role)
  const target = media.find((m) => m.id === id)
  if (!target || ROLE_KIND[target.role] !== ROLE_KIND[role]) throw new Error("This file cannot take that role.")
  const next = media.map((m): MediaItem => {
    if (m.id === id) return { ...m, role }
    // A single-slot role (source) demotes the previous holder instead of dropping it.
    if (role === "source" && m.role === "source") return { ...m, role: "video" }
    return m
  })
  for (const r of ["source", "video"] as const)
    if (next.filter((m) => m.role === r).length > (model.roles[r] ?? 0))
      throw new Error(`Maximum ${model.roles[r] ?? 0} for this role.`)
  return next
}

export type Capability = "text" | "start" | "frames" | "refs" | "source" | "audio"

/** Short capability chips for the model picker. */
export function capabilities(model: ModelEntry): Capability[] {
  const caps: Capability[] = []
  const r = model.roles
  if (!r.source && (model.surface === "image" || !model.requiredRoles?.length)) caps.push("text")
  if (r.start && r.end) caps.push("frames")
  else if (r.start) caps.push("start")
  if (r.reference || r.video) caps.push("refs")
  if (r.source) caps.push("source")
  if (r.audio) caps.push("audio")
  return caps
}

/** CSS aspect-ratio for a generation placeholder. */
export function aspectOf(settings: Record<string, unknown>, fallback: string): string {
  const value = typeof settings.aspectRatio === "string" ? settings.aspectRatio : fallback
  const match = /^(\d+):(\d+)$/.exec(value)
  return match ? `${match[1]} / ${match[2]}` : fallback.replace(":", " / ")
}

/** Downloads cross-origin media; falls back to opening it when CORS blocks the fetch. */
export async function downloadMedia(url: string, name: string) {
  try {
    const response = await fetch(url, { credentials: "omit" })
    if (!response.ok) throw new Error(String(response.status))
    const blob = await response.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const ext = blob.type.split("/")[1]?.split(";")[0] ?? ""
    a.href = href
    a.download = ext && !name.includes(".") ? `${name}.${ext}` : name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}
