import { z } from "zod"

import type { ToolName } from "./types"
import { MAX_PROMPT_CHARS } from "@/lib/config"

/**
 * The agent's tools. One JSON schema per tool, shared by every provider, plus
 * the zod schemas the server validates streamed inputs with. Asset ids are
 * the handles the agent uses for media: "u1".. for the user's uploads,
 * "a1".. for everything generated in the chat.
 */

const settings = {
  type: "object",
  description:
    'Model settings as key → value, only keys the chosen model lists in the catalog, e.g. {"aspectRatio": "9:16", "resolution": "1080p", "duration": "5"}.',
  additionalProperties: { type: "string" },
} as const

const ids = (description: string) => ({ type: "array", items: { type: "string" }, description }) as const

export const TOOL_SPECS: Array<{ name: ToolName; description: string; input_schema: Record<string, unknown> }> = [
  {
    name: "generate_image",
    description:
      "Generate one image (or a small batch where the model supports it) on Higgsfield. Returns new asset ids and the images themselves so you can review them. Use references for products, characters, style frames or earlier shots you must stay consistent with.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "3-6 word label shown to the user, in their language." },
        prompt: { type: "string", description: "Complete, production-ready English prompt." },
        model: { type: "string", description: 'Catalog model id, or "auto".' },
        settings,
        references: ids("Asset ids of reference images (uploads or earlier images)."),
      },
      required: ["title", "prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_video",
    description:
      "Generate one video clip on Higgsfield. start_frame animates an image asset (text-to-video without it); end_frame also fixes the last frame. Returns the new asset id when the clip is ready. You cannot watch videos, so plan them from reviewed keyframes.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "3-6 word label shown to the user, in their language." },
        prompt: { type: "string", description: "Complete English prompt: action, camera movement, pacing, lighting." },
        model: { type: "string", description: 'Catalog model id, or "auto".' },
        settings,
        start_frame: { type: "string", description: "Image asset id to animate, or empty." },
        end_frame: { type: "string", description: "Image asset id for the last frame, or empty (needs start_frame)." },
        references: ids("Reference image asset ids for models that take references instead of frames."),
      },
      required: ["title", "prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "remember",
    description:
      "Save one lasting fact about the user's brand or taste to the studio memory, so every future chat applies it (e.g. brand colors, product names, preferred formats, styles they love or hate).",
    input_schema: {
      type: "object",
      properties: { fact: { type: "string", description: "One short fact, in the user's language." } },
      required: ["fact"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_user",
    description:
      "Pause and ask the user one question, e.g. to approve a storyboard before spending credits on video, or when the brief genuinely leaves a blocking choice open. Offer 2-4 short options. The run continues when they answer.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question, in the user's language." },
        options: { type: "array", items: { type: "string" }, description: "2-4 short answer options, in the user's language." },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
]

const Settings = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
const Ids = z.array(z.string().max(16)).max(8).optional()

export const TOOL_INPUTS = {
  generate_image: z.object({
    title: z.string().max(200),
    prompt: z.string().min(1).max(MAX_PROMPT_CHARS),
    model: z.string().max(64).optional(),
    settings: Settings,
    references: Ids,
  }),
  generate_video: z.object({
    title: z.string().max(200),
    prompt: z.string().min(1).max(MAX_PROMPT_CHARS),
    model: z.string().max(64).optional(),
    settings: Settings,
    start_frame: z.string().max(16).optional(),
    end_frame: z.string().max(16).optional(),
    references: Ids,
  }),
  remember: z.object({ fact: z.string().min(1).max(300) }),
  ask_user: z.object({
    question: z.string().min(1).max(2000),
    options: z.array(z.string().max(200)).max(6).optional(),
  }),
} satisfies Record<ToolName, z.ZodType>

export type GenerateImageInput = z.infer<typeof TOOL_INPUTS.generate_image>
export type GenerateVideoInput = z.infer<typeof TOOL_INPUTS.generate_video>
export type AskUserInput = z.infer<typeof TOOL_INPUTS.ask_user>

export function isToolName(name: string): name is ToolName {
  return name === "generate_image" || name === "generate_video" || name === "remember" || name === "ask_user"
}
