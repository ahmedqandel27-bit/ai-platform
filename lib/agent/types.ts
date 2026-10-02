/**
 * Shared (client + server) types for the Super Computer agent.
 *
 * The conversation is stored in the browser as a provider-neutral transcript.
 * Assistant turns also keep the provider's raw content (for Claude: thinking
 * blocks with signatures), which is sent back byte-for-byte on every later
 * turn — the history is append-only and never edited.
 */

export const EFFORTS = ["low", "medium", "high", "max"] as const
export type Effort = (typeof EFFORTS)[number]

/** Higgsfield's own Supercomputer (Agent API), run with the user's Higgsfield key. */
export const HF_AGENT_ID = "higgsfield-supercomputer"
/** The classic planner (plan card + Run all), always available as a fallback. */
export const CLASSIC_ID = "classic-planner"

export type AgentModelInfo = {
  id: string
  label: string
  provider: "higgsfield" | "anthropic" | "openrouter" | "classic"
  /** Short line under the name in the picker. */
  blurb: string
  /** Shown as a "high cost" hint in the picker. */
  premium: boolean
  /** Whether the effort setting is sent to this model. */
  effort: boolean
}

export type ToolName = "generate_image" | "generate_video" | "remember" | "ask_user"

export type ToolCall = {
  id: string
  name: ToolName
  input: Record<string, unknown>
  /** Set by the server when the streamed input did not validate; the client answers with an error result. */
  invalid?: string
}

export type ToolResult = {
  id: string
  ok: boolean
  text: string
  /** Generated or attached images the model should look at (URLs). */
  images?: string[]
}

export type TranscriptUpload = { id: string; url: string; kind: "image" | "video" | "audio" }

export type AgentTurn =
  | {
      role: "user"
      text: string
      uploads: TranscriptUpload[]
      /** Sent to the model ahead of the text but not shown in the chat (studio memory). */
      context?: string
      /** The creative director's brief written from this message (Higgsfield runs). */
      brief?: string
    }
  | {
      role: "assistant"
      text: string
      /** Summarized reasoning, shown collapsed in the chat. */
      thinking?: string
      calls: ToolCall[]
      /** Provider-native content, replayed unchanged (Claude only). */
      raw?: { provider: "anthropic"; content: unknown[] }
      model: string
      /** Media the turn delivered directly (the Higgsfield agent returns links, not tool calls). */
      assetIds?: string[]
    }
  | {
      role: "tool"
      results: ToolResult[]
      /** When the turn answers an ask_user question: what the user typed, for display. */
      answer?: { text: string; uploads: TranscriptUpload[] }
    }

export type AgentTurnResponse = {
  text: string
  thinking?: string
  calls: ToolCall[]
  raw?: { provider: "anthropic"; content: unknown[] }
  model: string
}
