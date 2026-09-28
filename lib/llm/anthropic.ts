import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"

import { PlanDraftSchema, type PlanDraft } from "@/lib/supercomputer/plan-schema"
import { LLMError, type LLMProvider, type PlanRequest, type TextRequest } from "./types"

const DEFAULT_MODEL = "claude-opus-5"
/** Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01"

/**
 * Claude via the official Anthropic SDK. Credentials: LLM_API_KEY, else the
 * SDK's own resolution (ANTHROPIC_API_KEY, …). Model: LLM_MODEL or claude-opus-5.
 */
export function createAnthropicProvider(): LLMProvider {
  const client = new Anthropic({
    ...(process.env.LLM_API_KEY ? { apiKey: process.env.LLM_API_KEY } : {}),
    ...(process.env.LLM_BASE_URL ? { baseURL: process.env.LLM_BASE_URL } : {}),
    maxRetries: 2,
  })
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL

  return {
    id: "anthropic",

    async plan({ system, turns, images }: PlanRequest): Promise<PlanDraft> {
      const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((turn, index) => {
        const isLast = index === turns.length - 1
        if (turn.role === "user" && isLast && images.length) {
          return {
            role: "user",
            content: [
              ...images.map((url): Anthropic.Beta.BetaImageBlockParam => ({ type: "image", source: { type: "url", url } })),
              { type: "text", text: turn.text },
            ],
          }
        }
        return { role: turn.role, content: turn.text }
      })

      try {
        const response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          // The catalog-heavy system prompt is stable across requests → cache it.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages,
          output_config: { format: betaZodOutputFormat(PlanDraftSchema) },
        })
        if (response.stop_reason === "refusal")
          throw new LLMError("The planner declined this request. Try rephrasing it.", "refused")
        if (response.stop_reason === "max_tokens")
          throw new LLMError("The plan was too long. Ask for fewer steps.", "invalid_output")
        if (!response.parsed_output) throw new LLMError("The planner returned an unreadable plan.", "invalid_output")
        return response.parsed_output
      } catch (caught) {
        throw toLLMError(caught)
      }
    },

    async text({ system, prompt, maxTokens = 4000 }: TextRequest): Promise<string> {
      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: maxTokens,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          // Short, routine rewriting: low effort keeps it fast and cheap.
          output_config: { effort: "low" },
          system,
          messages: [{ role: "user", content: prompt }],
        })
        if (response.stop_reason === "refusal")
          throw new LLMError("The model declined this request. Try rephrasing it.", "refused")
        const text = response.content
          .flatMap((block) => (block.type === "text" ? [block.text] : []))
          .join("")
          .trim()
        if (!text) throw new LLMError("The model returned no text.", "invalid_output")
        return text
      } catch (caught) {
        throw toLLMError(caught)
      }
    },
  }
}

function toLLMError(caught: unknown): LLMError {
  if (caught instanceof LLMError) return caught
  if (caught instanceof Anthropic.RateLimitError) return new LLMError("The planner is rate limited. Try again shortly.", "rate_limited")
  if (caught instanceof Anthropic.AuthenticationError || caught instanceof Anthropic.PermissionDeniedError)
    return new LLMError("The planner API key was rejected. Check LLM_API_KEY on the server.", "not_configured")
  if (caught instanceof Anthropic.APIError)
    return new LLMError(`Planner error (${caught.status ?? "network"}). Try again.`, "provider_error")
  return new LLMError(caught instanceof Error ? caught.message : String(caught), "provider_error")
}
