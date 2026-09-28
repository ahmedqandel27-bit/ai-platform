import { toAuthorizationHeader } from "./credentials"
import { parseUploadTicket, requireUploadContentType } from "./upload-contract"
import type { UploadTicket } from "./upload-contract"

const UPLOAD_PATH = "/files/generate-upload-url"
const MODEL_ID = /^[a-z0-9][a-z0-9._/-]*$/i
const VERBOSE = process.env.NODE_ENV === "development"

export class PlatformError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, host?: string) {
    super(messageFromBody(status, body, host))
    this.name = "PlatformError"
    this.status = status
    this.body = body
  }
}

export type QueuedGeneration = {
  status: string
  requestId: string
  statusUrl: string
  cancelUrl: string
}

export type GenerationStatus = {
  status: string
  requestId: string
  images?: Array<{ url: string }>
  video?: { url: string }
  error?: unknown
}

/** One request's answer inside a batched status poll. A request that errors
    carries its reason alone, so it cannot lose the answers standing beside it. */
export type StatusResult =
  | { requestId: string; status: GenerationStatus }
  | { requestId: string; error: string }

export type PlatformClientOptions = {
  apiKey: string
  baseUrl: string
  fetch?: typeof fetch
}

export function isModelId(model: string): boolean {
  return MODEL_ID.test(model) && !model.includes("..")
}

export function createPlatformClient(options: PlatformClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const fetchImpl = options.fetch ?? fetch
  const auth = toAuthorizationHeader(options.apiKey)

  async function send(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ) {
    const url = `${baseUrl}${path}`
    // Bodies (prompts, media URLs) are only logged in development.
    console.info("[platform] request", { method, url, ...(VERBOSE ? { body: body ?? null } : {}) })
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: auth,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const payload = await readJson(response)
    // Signed upload URLs are credentials; do not write them to logs.
    console.info("[platform] response", {
      method,
      url,
      status: response.status,
      ...(path === UPLOAD_PATH || !VERBOSE ? {} : { body: payload }),
    })
    if (!response.ok) throw new PlatformError(response.status, payload, new URL(url).host)
    return payload
  }

  return {
    async createUpload(contentType: unknown): Promise<UploadTicket> {
      const type = requireUploadContentType(contentType)
      return parseUploadTicket(
        await send("POST", UPLOAD_PATH, { content_type: type }),
        type
      )
    },
    async submit(
      model: string,
      input: Record<string, unknown>
    ): Promise<QueuedGeneration> {
      if (!isModelId(model))
        throw new PlatformError(400, { detail: "Invalid model" })
      return mapQueued(await send("POST", `/${model}`, input))
    },
    async status(requestId: string): Promise<GenerationStatus> {
      if (!requestId)
        throw new PlatformError(400, { detail: "Missing request id" })
      return mapStatus(
        await send("GET", `/requests/${encodeURIComponent(requestId)}/status`)
      )
    },
    /** Queued requests only; the platform answers 202 and the status turns "canceled". */
    async cancel(requestId: string): Promise<void> {
      if (!requestId)
        throw new PlatformError(400, { detail: "Missing request id" })
      await send(
        "POST",
        `/requests/${encodeURIComponent(requestId)}/cancel`,
        {}
      )
    },
  }
}

function mapQueued(payload: unknown): QueuedGeneration {
  const data = asRecord(payload)
  const requestId = stringField(data, "request_id")
  if (!requestId)
    throw new PlatformError(502, {
      detail: "Platform response missing request_id",
    })
  return {
    status: stringField(data, "status") ?? "queued",
    requestId,
    statusUrl: stringField(data, "status_url") ?? "",
    cancelUrl: stringField(data, "cancel_url") ?? "",
  }
}

function mapStatus(payload: unknown): GenerationStatus {
  const data = asRecord(payload)
  const requestId = stringField(data, "request_id") ?? ""
  const images = Array.isArray(data.images)
    ? data.images.flatMap((item) => {
        const url = asRecord(item).url
        return typeof url === "string" ? [{ url }] : []
      })
    : undefined
  const videoUrl = asRecord(data.video).url

  return {
    status: stringField(data, "status") ?? "unknown",
    requestId,
    ...(images?.length ? { images } : {}),
    ...(typeof videoUrl === "string" ? { video: { url: videoUrl } } : {}),
    ...(data.error !== undefined ? { error: data.error } : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const field = value[key]
  return typeof field === "string" ? field : undefined
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Higgsfield's own reason plus the HTTP status and the host that answered,
 * so a rejected request can be diagnosed from the UI (no secrets included).
 */
function messageFromBody(status: number, body: unknown, host?: string): string {
  const where = host ? ` · ${host}` : ""
  return `${describeBody(body) ?? "Platform request failed"} (HTTP ${status}${where})`
}

function describeBody(body: unknown): string | null {
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 300)
  const record = asRecord(body)
  for (const key of ["detail", "message", "error"]) {
    const value = record[key]
    if (typeof value === "string" && value) return value.slice(0, 300)
    if (value && typeof value === "object") {
      const nested = asRecord(value)
      if (typeof nested.message === "string" && nested.message) return nested.message.slice(0, 300)
    }
  }
  // FastAPI-style validation errors: [{ loc, msg }]
  if (Array.isArray(record.detail)) {
    const msgs = record.detail
      .map((item) => {
        const entry = asRecord(item)
        const loc = Array.isArray(entry.loc) ? entry.loc.join(".") : ""
        return typeof entry.msg === "string" ? `${loc ? `${loc}: ` : ""}${entry.msg}` : null
      })
      .filter(Boolean)
    if (msgs.length) return msgs.join("; ").slice(0, 300)
  }
  return null
}
