import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { LLMError } from "@/lib/llm/types"
import { TOOL_INPUTS, TOOL_SPECS, isToolName } from "./tools"
import type { AgentTurn, AgentTurnResponse, Effort, ToolCall } from "./types"

/** Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01"
const MAX_JSON_RETRIES = 2

function client() {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase()
  const key = process.env.ANTHROPIC_API_KEY?.trim() || (!provider || provider === "anthropic" ? process.env.LLM_API_KEY?.trim() : undefined)
  return new Anthropic({ ...(key ? { apiKey: key } : {}), maxRetries: 2 })
}

// Deterministic tool list (same bytes every request → cache friendly).
const TOOLS: Anthropic.Beta.BetaToolUnion[] = TOOL_SPECS.map((spec) => ({
  name: spec.name,
  description: spec.description,
  input_schema: spec.input_schema as Anthropic.Beta.BetaTool.InputSchema,
  eager_input_streaming: true,
}))

/**
 * Transcript → Messages API history. Deterministic and append-only: earlier
 * turns always render to the same bytes, and assistant turns replay the raw
 * content Claude returned (thinking blocks included) unchanged.
 */
function toMessages(transcript: AgentTurn[]): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = []
  for (const turn of transcript) {
    if (turn.role === "user") {
      const note = turn.uploads.length
        ? `\n\n[Attached: ${turn.uploads.map((u) => `${u.id} (${u.kind})`).join(", ")}]`
        : ""
      messages.push({
        role: "user",
        content: [
          ...turn.uploads
            .filter((u) => u.kind === "image")
            .map((u): Anthropic.Beta.BetaImageBlockParam => ({ type: "image", source: { type: "url", url: u.url } })),
          { type: "text", text: (turn.text || "(see attached files)") + note },
        ],
      })
    } else if (turn.role === "assistant") {
      if (turn.raw?.provider === "anthropic" && turn.raw.content.length) {
        messages.push({ role: "assistant", content: turn.raw.content as Anthropic.Beta.BetaContentBlockParam[] })
      } else {
        const content: Anthropic.Beta.BetaContentBlockParam[] = []
        if (turn.text) content.push({ type: "text", text: turn.text })
        for (const call of turn.calls) content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input })
        messages.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: "…" }] })
      }
    } else {
      messages.push({
        role: "user",
        content: turn.results.map(
          (r): Anthropic.Beta.BetaToolResultBlockParam => ({
            type: "tool_result",
            tool_use_id: r.id,
            ...(r.ok ? {} : { is_error: true }),
            content: [
              { type: "text", text: r.text },
              ...(r.images ?? []).map((url): Anthropic.Beta.BetaImageBlockParam => ({ type: "image", source: { type: "url", url } })),
            ],
          }),
        ),
      })
    }
  }
  // Cache the whole conversation so far: the next turn reads it from cache.
  const last = messages[messages.length - 1]
  if (last && Array.isArray(last.content) && last.content.length) {
    const block = last.content[last.content.length - 1] as { cache_control?: unknown }
    last.content[last.content.length - 1] = { ...block, cache_control: { type: "ephemeral" } } as Anthropic.Beta.BetaContentBlockParam
  }
  return messages
}

export async function anthropicAgentTurn(input: {
  model: string
  effort: Effort
  system: string
  transcript: AgentTurn[]
}): Promise<AgentTurnResponse> {
  const api = client()
  const messages = toMessages(input.transcript)

  for (let attempt = 0; ; attempt++) {
    let message: Anthropic.Beta.BetaMessage
    try {
      const stream = api.beta.messages.stream({
        model: input.model,
        max_tokens: 64000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: input.effort },
        system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      })
      message = await stream.finalMessage()
    } catch (caught) {
      // Eagerly streamed tool input that is not JSON at all: re-issue the request.
      if (!(caught instanceof Anthropic.APIError) && caught instanceof SyntaxError && attempt < MAX_JSON_RETRIES) continue
      throw toLLMError(caught)
    }

    if (message.stop_reason === "refusal")
      throw new LLMError("The model declined this request. Try rephrasing it.", "refused")
    if (message.stop_reason === "max_tokens")
      throw new LLMError("The model ran out of room in one step. Try a smaller request.", "invalid_output")

    const text = message.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim()
    const thinking = message.content
      .flatMap((b) => (b.type === "thinking" && b.thinking ? [b.thinking] : []))
      .join("\n\n")
      .trim()
    const calls: ToolCall[] = message.content.flatMap((b): ToolCall[] => {
      if (b.type !== "tool_use") return []
      const input = (b.input && typeof b.input === "object" ? b.input : {}) as Record<string, unknown>
      if (!isToolName(b.name)) return [{ id: b.id, name: "ask_user", input, invalid: `Unknown tool "${b.name}".` }]
      // Eager streaming skips server-side validation: validate before anything runs.
      const parsed = TOOL_INPUTS[b.name].safeParse(input)
      return [{ id: b.id, name: b.name, input, ...(parsed.success ? {} : { invalid: JSON.stringify(input).slice(0, 2000) }) }]
    })

    return {
      text,
      ...(thinking ? { thinking } : {}),
      calls,
      raw: { provider: "anthropic", content: message.content as unknown[] },
      model: message.model,
    }
  }
}

function toLLMError(caught: unknown): LLMError {
  if (caught instanceof LLMError) return caught
  if (caught instanceof Anthropic.RateLimitError) return new LLMError("The model is rate limited. Try again shortly.", "rate_limited")
  if (caught instanceof Anthropic.AuthenticationError || caught instanceof Anthropic.PermissionDeniedError)
    return new LLMError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY on the server.", "not_configured")
  if (caught instanceof Anthropic.BadRequestError)
    return new LLMError(`The model rejected the request: ${caught.message}`, "provider_error")
  if (caught instanceof Anthropic.APIError) return new LLMError(`Model error (${caught.status ?? "network"}). Try again.`, "provider_error")
  return new LLMError(caught instanceof Error ? caught.message : String(caught), "provider_error")
}
