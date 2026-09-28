import { MissingCredentialsError } from "./credentials"
import { PlatformError } from "./platform"

/**
 * Stable, translatable error codes returned by server actions.
 * Server actions never throw to the client (production builds mask thrown
 * messages), they return `{ ok: false, error }` instead.
 */
export type GenerationErrorCode =
  | "missing_key"
  | "invalid_key"
  | "insufficient_credits"
  | "rate_limited"
  | "invalid_input"
  | "content_blocked"
  | "not_found"
  | "duplicate"
  | "submit_unknown"
  | "timeout"
  | "platform_error"
  | "unauthenticated"
  | "model_disabled"
  | "budget_exceeded"
  | "daily_cap_exceeded"

export type GenerationError = { code: GenerationErrorCode; message: string }

export type Result<T> = { ok: true; data: T } | { ok: false; error: GenerationError }

export function fail(code: GenerationErrorCode, message: string): { ok: false; error: GenerationError } {
  return { ok: false, error: { code, message } }
}

/** Maps anything thrown by the platform client / validators to a coded error. */
export function toGenerationError(caught: unknown): GenerationError {
  if (caught instanceof MissingCredentialsError)
    return { code: "missing_key", message: caught.message }
  if (caught instanceof PlatformError) {
    const { status, message } = caught
    if (status === 401 || status === 403) return { code: "invalid_key", message }
    // 402 mapping follows common API convention; not verified against Higgsfield docs.
    if (status === 402) return { code: "insufficient_credits", message }
    if (status === 429) return { code: "rate_limited", message }
    if (status === 400 || status === 404 || status === 422) return { code: "invalid_input", message }
    return { code: "platform_error", message }
  }
  if (caught instanceof Error) {
    if (caught.name === "TimeoutError" || caught.name === "AbortError")
      return { code: "timeout", message: caught.message }
    // Catalog validators (media roles, required prompt, settings) throw plain Errors.
    return { code: "invalid_input", message: caught.message }
  }
  return { code: "platform_error", message: String(caught) }
}
