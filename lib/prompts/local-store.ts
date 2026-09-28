"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { SavedPrompt } from "./actions"

/** Preview mode only (no Supabase): prompts saved in this browser. */
export const useLocalPrompts = create<{
  prompts: SavedPrompt[]
  upsert: (prompt: SavedPrompt) => void
  remove: (id: string) => void
}>()(
  persist(
    (set) => ({
      prompts: [],
      upsert: (prompt) => set((s) => ({ prompts: [prompt, ...s.prompts.filter((p) => p.id !== prompt.id)] })),
      remove: (id) => set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) })),
    }),
    { name: "nexus-prompts-v1" },
  ),
)
