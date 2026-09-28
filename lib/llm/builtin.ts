import "server-only"

import { heuristicPlan } from "@/lib/supercomputer/heuristic"
import type { PlanDraft } from "@/lib/supercomputer/plan-schema"
import { LLMError, type LLMProvider, type PlanRequest } from "./types"

/**
 * Keyword planner used when no LLM is configured. It understands the common
 * shapes ("N-second ad, K shots, a 4:5 poster") in Arabic and English so the
 * Super Computer stays usable; an LLM gives far better plans and prompts.
 */
export function createBuiltinProvider(): LLMProvider {
  return {
    id: "builtin",
    async plan({ turns, images }: PlanRequest): Promise<PlanDraft> {
      const text = [...turns].reverse().find((t) => t.role === "user")?.text ?? ""
      return heuristicPlan(text, images.length)
    },
    async text() {
      throw new LLMError("Text tools need an LLM. Set LLM_PROVIDER and its key on the server.", "not_configured")
    },
  }
}
