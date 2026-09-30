import "server-only"

import { LLMError } from "@/lib/llm/types"
import { TOOL_INPUTS, TOOL_SPECS, isToolName } from "./tools"
import type { AgentTurn, AgentTurnResponse, ToolCall } from "./types"

const BASE_URL = "https://openrouter.ai/api/v1"

type ChatMessage =
  | { role: "system" | "user"; content: string | Array<Record<string, unknown>> }
  | { role: "assistant"; content: string | null; tool_calls?: Array<Record<string, unknown>> }
  | { role: "tool"; tool_call_id: string; content: string }

/** Transcript → OpenAI chat-completions messages (tool results carry text; their images follow as a user message). */
function toMessages(system: string, transcript: AgentTurn[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: system }]
  for (const turn of transcript) {
    if (turn.role === "user") {
      const note = turn.uploads.length ? `\n\n[Attached: ${turn.uploads.map((u) => `${u.id} (${u.kind})`).join(", ")}]` : ""
      messages.push({
        role: "user",
        content: [
          ...turn.uploads.filter((u) => u.kind === "image").map((u) => ({ type: "image_url", image_url: { url: u.url } })),
          { type: "text", text: (turn.text || "(see attached files)") + note },
        ],
      })
    } else if (turn.role === "assistant") {
      messages.push({
        role: "assistant",
        content: turn.text || null,
        ...(turn.calls.length
          ? {
              tool_calls: turn.calls.map((c) => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      })
    } else {
      for (const r of turn.results) messages.push({ role: "tool", tool_call_id: r.id, content: (r.ok ? "" : "ERROR: ") + r.text })
      const images = turn.results.flatMap((r) => r.images ?? [])
      if (images.length)
        messages.push({
          role: "user",
          content: [
            { type: "text", text: "Images returned by the tools above, for your review:" },
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        })
    }
  }
  return messages
}

export async function openRouterAgentTurn(input: { model: string; system: string; transcript: AgentTurn[] }): Promise<AgentTurnResponse> {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) throw new LLMError("Set OPENROUTER_API_KEY on the server to use this model.", "not_configured")

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      messages: toMessages(input.system, input.transcript),
      tools: TOOL_SPECS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
      max_tokens: 16000,
    }),
    signal: AbortSignal.timeout(280_000),
  })
  if (response.status === 429) throw new LLMError("The model is rate limited. Try again shortly.", "rate_limited")
  if (response.status === 401 || response.status === 403)
    throw new LLMError("The OpenRouter key was rejected. Check OPENROUTER_API_KEY on the server.", "not_configured")
  if (response.status === 402) throw new LLMError("The OpenRouter account is out of credits.", "not_configured")
  if (!response.ok) throw new LLMError(`Model error (${response.status}). Try again.`, "provider_error")

  const data = (await response.json()) as {
    model?: string
    choices?: Array<{
      finish_reason?: string
      message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
    }>
  }
  const choice = data.choices?.[0]
  if (choice?.finish_reason === "length") throw new LLMError("The model ran out of room in one step. Try a smaller request.", "invalid_output")
  const message = choice?.message
  const calls: ToolCall[] = (message?.tool_calls ?? []).map((tc) => {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>
    } catch {
      return { id: tc.id, name: "ask_user", input: {}, invalid: tc.function.arguments.slice(0, 2000) }
    }
    if (!isToolName(tc.function.name)) return { id: tc.id, name: "ask_user", input: parsed, invalid: `Unknown tool "${tc.function.name}".` }
    const valid = TOOL_INPUTS[tc.function.name].safeParse(parsed)
    return { id: tc.id, name: tc.function.name, input: parsed, ...(valid.success ? {} : { invalid: tc.function.arguments.slice(0, 2000) }) }
  })
  return { text: (message?.content ?? "").trim(), calls, model: data.model ?? input.model }
}
