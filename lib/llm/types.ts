import type { PlanDraft } from "@/lib/supercomputer/plan-schema"

export type ChatTurn = { role: "user" | "assistant"; text: string }
export type ChatUpload = { url: string; kind: "image" | "video" | "audio" }

export type PlanRequest = {
  system: string
  turns: ChatTurn[]
  /** Images attached to the latest user turn (sent to vision-capable providers). */
  images: string[]
}

export type TextRequest = { system: string; prompt: string; maxTokens?: number }

/** A text/LLM backend for the Super Computer planner and prompt tools. */
export interface LLMProvider {
  readonly id: "anthropic" | "openai-compatible" | "builtin"
  plan(request: PlanRequest): Promise<PlanDraft>
  text(request: TextRequest): Promise<string>
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "refused" | "rate_limited" | "invalid_output" | "provider_error",
  ) {
    super(message)
    this.name = "LLMError"
  }
}
