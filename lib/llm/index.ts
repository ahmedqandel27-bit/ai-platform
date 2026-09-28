import "server-only"

import { createAnthropicProvider } from "./anthropic"
import { createBuiltinProvider } from "./builtin"
import { createOpenAICompatibleProvider } from "./openai-compatible"
import type { LLMProvider } from "./types"

export type LLMProviderId = LLMProvider["id"]

/**
 * Picks the planner backend from env:
 * - LLM_PROVIDER=anthropic (default when an Anthropic key is present)
 * - LLM_PROVIDER=openai-compatible (needs LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)
 * - otherwise the built-in keyword planner (no text tools).
 */
export function resolveProviderId(): LLMProviderId {
  const choice = process.env.LLM_PROVIDER?.trim().toLowerCase()
  const anthropicKey = Boolean(process.env.LLM_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim())
  // A provider without credentials falls back to the built-in planner, so the
  // Super Computer works out of the box and upgrades once a key is added.
  if (choice === "openai-compatible")
    return process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL ? "openai-compatible" : "builtin"
  if (choice === "builtin" || choice === "none") return "builtin"
  return anthropicKey ? "anthropic" : "builtin"
}

export function getLLM(): LLMProvider {
  switch (resolveProviderId()) {
    case "anthropic":
      return createAnthropicProvider()
    case "openai-compatible":
      return createOpenAICompatibleProvider()
    default:
      return createBuiltinProvider()
  }
}
