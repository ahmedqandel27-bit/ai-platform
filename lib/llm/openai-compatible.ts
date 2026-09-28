import "server-only"

import { PlanDraftSchema, type PlanDraft } from "@/lib/supercomputer/plan-schema"
import { LLMError, type LLMProvider, type PlanRequest, type TextRequest } from "./types"

/**
 * Any OpenAI-compatible chat-completions endpoint (LLM_BASE_URL + LLM_API_KEY
 * + LLM_MODEL), for teams that prefer another provider. JSON mode is
 * requested and the result is validated with the same schema as the default
 * provider.
 */
export function createOpenAICompatibleProvider(): LLMProvider {
  const baseUrl = process.env.LLM_BASE_URL?.trim().replace(/\/$/, "")
  const apiKey = process.env.LLM_API_KEY?.trim()
  const model = process.env.LLM_MODEL?.trim()
  if (!baseUrl || !apiKey || !model)
    throw new LLMError("Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL for the openai-compatible provider.", "not_configured")

  async function chat(messages: unknown[], json: boolean, maxTokens: number): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(120_000),
    })
    if (response.status === 429) throw new LLMError("The planner is rate limited. Try again shortly.", "rate_limited")
    if (response.status === 401 || response.status === 403)
      throw new LLMError("The planner API key was rejected. Check LLM_API_KEY on the server.", "not_configured")
    if (!response.ok) throw new LLMError(`Planner error (${response.status}). Try again.`, "provider_error")
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content?.trim() ?? ""
  }

  return {
    id: "openai-compatible",

    async plan({ system, turns, images }: PlanRequest): Promise<PlanDraft> {
      const messages = [
        { role: "system", content: `${system}\n\nRespond with a single JSON object only.` },
        ...turns.map((turn, index) =>
          turn.role === "user" && index === turns.length - 1 && images.length
            ? {
                role: "user",
                content: [
                  ...images.map((url) => ({ type: "image_url", image_url: { url } })),
                  { type: "text", text: turn.text },
                ],
              }
            : { role: turn.role, content: turn.text },
        ),
      ]
      const raw = await chat(messages, true, 8000)
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new LLMError("The planner returned an unreadable plan.", "invalid_output")
      }
      const result = PlanDraftSchema.safeParse(parsed)
      if (!result.success) throw new LLMError("The planner returned an invalid plan.", "invalid_output")
      return result.data
    },

    async text({ system, prompt, maxTokens = 4000 }: TextRequest): Promise<string> {
      const text = await chat(
        [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        false,
        maxTokens,
      )
      if (!text) throw new LLMError("The model returned no text.", "invalid_output")
      return text
    },
  }
}
