import { z } from "zod"

/**
 * What the planner LLM must return (structured output). Kept flat: no
 * optional fields or free-form objects, so every provider's JSON mode can
 * produce it. Empty strings / arrays mean "none".
 *
 * Input references use a small address syntax:
 *   "step:<id>"  → the first output of an earlier image step
 *   "upload:<n>" → the n-th file the user attached in the chat (0-based)
 */
export const PlanStepSchema = z.object({
  id: z.string().describe('Short unique id, e.g. "s1".'),
  tool: z.enum(["generate_image", "generate_video", "write_script"]),
  title: z.string().describe("3-6 word label shown on the card, in the user's language."),
  model: z.string().describe('Catalog model id, or "auto". Ignored for write_script.'),
  prompt: z
    .string()
    .describe(
      "For generation steps: a complete, enhanced English prompt (subject, action, camera, lighting, style). For write_script: the brief for the text.",
    ),
  settings: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe("Model settings as key/value strings, e.g. aspectRatio=9:16, duration=5."),
  start_frame: z.string().describe('"" or "step:<id>" / "upload:<n>" (video only).'),
  end_frame: z.string().describe('"" or "step:<id>" / "upload:<n>" (video only, needs a start frame).'),
  references: z.array(z.string()).describe('Reference images: "step:<id>" / "upload:<n>".'),
})

export const PlanDraftSchema = z.object({
  reply: z.string().describe("Short message to the user in THEIR language explaining the plan or answering them."),
  title: z.string().describe("Plan title (empty string when no steps)."),
  steps: z.array(PlanStepSchema).describe("Ordered steps; empty when the user only asked a question."),
})

export type PlanStepDraft = z.infer<typeof PlanStepSchema>
export type PlanDraft = z.infer<typeof PlanDraftSchema>
