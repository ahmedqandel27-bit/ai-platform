"use server"

import { z } from "zod"

import { toAuthorizationHeader } from "@/generation/credentials"
import { getViewer, resolveCredentials } from "@/generation/server-credentials"

/**
 * Higgsfield's own Supercomputer through its Agent API (preview): sessions,
 * messages, polling and interrupt, with the same Higgsfield key the studios
 * use. The agent runs on Higgsfield's side with all of its tools; we send the
 * brief and show what comes back. Billed to the Higgsfield account.
 */

type Failure = { ok: false; error: { code: string; message: string } }
type Result<T> = { ok: true; data: T } | Failure
const fail = (code: string, message: string): Failure => ({ ok: false, error: { code, message } })

export type HfAgentMessage = {
  id: string
  role: "user" | "assistant"
  status: "processing" | "completed" | "failed"
  text: string
  costUsd?: number
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<Result<T>> {
  const viewer = await getViewer()
  if (!viewer) return fail("unauthenticated", "Sign in to continue.")
  let credentials: Awaited<ReturnType<typeof resolveCredentials>>
  try {
    credentials = await resolveCredentials(viewer)
  } catch {
    return fail("missing_key", "Connect your Higgsfield API key first.")
  }
  let response: Response
  try {
    response = await fetch(`${credentials.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { Authorization: toAuthorizationHeader(credentials.apiKey), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    })
  } catch {
    return fail("network", "Could not reach Higgsfield. Try again.")
  }
  if (response.ok) {
    const text = await response.text()
    return { ok: true, data: (text ? JSON.parse(text) : null) as T }
  }
  const detail = await response
    .json()
    .then((d: { detail?: unknown }) => (typeof d?.detail === "string" ? d.detail : ""))
    .catch(() => "")
  switch (response.status) {
    case 401:
      return fail("invalid_key", "Higgsfield rejected the API key. Reconnect it from the sidebar.")
    case 402:
      return fail("insufficient_credits", "Your Higgsfield API balance is empty. Add funds on open.higgsfield.ai.")
    case 403:
      return fail(
        "agent_access",
        "Your Higgsfield API account doesn't have Agent API access yet. Ask Higgsfield support to enable it — meanwhile pick Claude in the model menu.",
      )
    case 409:
      return fail("busy", "The Higgsfield agent is still working on the previous message.")
    default:
      return fail("platform_error", `Higgsfield agent error (${response.status})${detail ? `: ${detail}` : ""}.`)
  }
}

/** Assistant rows carry structured parts; only text parts are the answer (the SDK's rule). */
function messageText(message: unknown): string {
  if (!message || typeof message !== "object") return ""
  const body = message as { text?: unknown; parts?: unknown }
  if (typeof body.text === "string") return body.text
  if (!Array.isArray(body.parts)) return ""
  return body.parts
    .filter((p): p is { type: "text"; text: string } => !!p && typeof p === "object" && p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n")
}

const Id = z.string().min(1).max(128).regex(/^[\w-]+$/)

export async function hfAgentStart(): Promise<Result<{ sessionId: string }>> {
  const result = await call<{ session_id?: string }>("POST", "/v1/agent/sessions", { config: {} })
  if (!result.ok) return result
  if (!result.data?.session_id) return fail("platform_error", "Higgsfield did not return a session.")
  return { ok: true, data: { sessionId: result.data.session_id } }
}

export async function hfAgentSend(input: unknown): Promise<Result<{ messageId: string }>> {
  const parsed = z.object({ sessionId: Id, content: z.string().min(1).max(20_000) }).safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  const result = await call<{ message_id?: string }>("POST", `/v1/agent/sessions/${parsed.data.sessionId}/messages`, {
    content: parsed.data.content,
  })
  if (!result.ok) return result
  if (!result.data?.message_id) return fail("platform_error", "Higgsfield did not accept the message.")
  return { ok: true, data: { messageId: result.data.message_id } }
}

export async function hfAgentPoll(
  input: unknown,
): Promise<Result<{ status: "idle" | "processing" | "awaiting_input" | "terminated"; messages: HfAgentMessage[] }>> {
  const parsed = z.object({ sessionId: Id, after: Id.optional() }).safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  const query = parsed.data.after ? `?after=${encodeURIComponent(parsed.data.after)}` : ""
  const result = await call<{ status?: string; messages?: Array<Record<string, unknown>> }>(
    "GET",
    `/v1/agent/sessions/${parsed.data.sessionId}/messages${query}`,
  )
  if (!result.ok) return result
  const status = result.data?.status
  const messages: HfAgentMessage[] = (result.data?.messages ?? []).map((row) => {
    const cost = Number(row.llm_cost_usd)
    return {
      id: String(row.message_id ?? ""),
      role: row.role === "user" ? "user" : "assistant",
      status: row.status === "completed" || row.status === "failed" ? row.status : "processing",
      text: messageText(row.message),
      ...(Number.isFinite(cost) && cost > 0 ? { costUsd: cost } : {}),
    }
  })
  return {
    ok: true,
    data: {
      status: status === "processing" || status === "awaiting_input" || status === "terminated" ? status : "idle",
      messages,
    },
  }
}

export async function hfAgentInterrupt(input: unknown): Promise<Result<null>> {
  const parsed = z.object({ sessionId: Id }).safeParse(input)
  if (!parsed.success) return fail("invalid_input", "Invalid request.")
  const result = await call<unknown>("POST", `/v1/agent/sessions/${parsed.data.sessionId}/interrupt`)
  return result.ok ? { ok: true, data: null } : result
}
