import "server-only"

import { CLASSIC_ID, HF_AGENT_ID, type AgentModelInfo } from "./types"

/**
 * The thinking models the Super Computer can run on. Claude models need an
 * Anthropic key (ANTHROPIC_API_KEY, or LLM_API_KEY with the anthropic
 * provider). Any other model (GPT, Gemini, Grok, …) comes through OpenRouter:
 * set OPENROUTER_API_KEY and, optionally, OPENROUTER_MODELS as a comma list of
 * "<openrouter model id>=<label>" pairs.
 */

const CLAUDE: AgentModelInfo[] = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    provider: "anthropic",
    blurb: "Best all-round for long production runs",
    premium: false,
    effort: true,
  },
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    provider: "anthropic",
    blurb: "Most capable, slower and pricier",
    premium: true,
    effort: true,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    provider: "anthropic",
    blurb: "Fast, lower cost for everyday work",
    premium: false,
    effort: true,
  },
]

const DEFAULT_OPENROUTER = "openai/gpt-5=GPT-5,google/gemini-2.5-pro=Gemini 2.5 Pro"

export function hasAnthropic(): boolean {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return true
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase()
  return Boolean(process.env.LLM_API_KEY?.trim()) && (!provider || provider === "anthropic")
}

export function hasOpenRouter(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim())
}

function openRouterModels(): AgentModelInfo[] {
  const list = (process.env.OPENROUTER_MODELS?.trim() || DEFAULT_OPENROUTER)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
  return list.flatMap((entry): AgentModelInfo[] => {
    const [id, label] = entry.split("=").map((s) => s.trim())
    if (!id || !/^[\w.-]+\/[\w.:-]+$/.test(id)) return []
    return [{ id, label: label || id, provider: "openrouter", blurb: `Via OpenRouter · ${id}`, premium: false, effort: false }]
  })
}

const HIGGSFIELD: AgentModelInfo = {
  id: HF_AGENT_ID,
  label: "Higgsfield Supercomputer",
  provider: "higgsfield",
  blurb: "Higgsfield's own agent · uses your Higgsfield key and credits",
  premium: false,
  effort: false,
}

const CLASSIC: AgentModelInfo = {
  id: CLASSIC_ID,
  label: "Classic planner",
  provider: "classic",
  blurb: "Editable plan card, you press Run",
  premium: false,
  effort: false,
}

/** Models available on this deployment, default first. */
export function availableAgentModels(): AgentModelInfo[] {
  return [HIGGSFIELD, ...(hasAnthropic() ? CLAUDE : []), ...(hasOpenRouter() ? openRouterModels() : []), CLASSIC]
}

/** Thinking models the in-app agent loop can run (Claude / OpenRouter). */
export function loopModels(): AgentModelInfo[] {
  return availableAgentModels().filter((m) => m.provider === "anthropic" || m.provider === "openrouter")
}

export function findAgentModel(id: string): AgentModelInfo | undefined {
  return loopModels().find((m) => m.id === id)
}
