"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { MODELS } from "../catalog"
import type { MediaItem, Surface } from "../catalog/types"

/** One controlled dock state per studio: model, prompt, settings and attachments. */
type ComposerState = {
  model: string
  prompt: string
  /** Settings remembered per model id. */
  settingsByModel: Record<string, Record<string, unknown>>
  media: MediaItem[]
  setModel: (model: string) => void
  setPrompt: (prompt: string) => void
  setSetting: (key: string, value: unknown) => void
  setMedia: (media: MediaItem[]) => void
  /** Loads a previous run's inputs back into the composer (Remix). */
  load: (input: { model: string; prompt: string; settings: Record<string, unknown>; media: MediaItem[] }) => void
}

function firstModel(surface: Surface) {
  return MODELS.find((m) => m.surface === surface)?.id ?? ""
}

function createComposer(surface: Surface) {
  return create<ComposerState>()(
    persist(
      (set) => ({
        model: firstModel(surface),
        prompt: "",
        settingsByModel: {},
        media: [],
        setModel: (model) => set({ model }),
        setPrompt: (prompt) => set({ prompt }),
        setSetting: (key, value) =>
          set((state) => ({
            settingsByModel: {
              ...state.settingsByModel,
              [state.model]: { ...state.settingsByModel[state.model], [key]: value },
            },
          })),
        setMedia: (media) => set({ media }),
        load: ({ model, prompt, settings, media }) =>
          set((state) => ({ model, prompt, media, settingsByModel: { ...state.settingsByModel, [model]: settings } })),
      }),
      {
        name: `nexus-composer-${surface}`,
        storage: createJSONStorage(() => localStorage),
        // Rehydrated after mount (see useHydrateComposer) to keep SSR markup stable.
        skipHydration: true,
        // A model removed from the catalog falls back to the first installed one.
        merge: (persisted, current) => {
          const next = { ...current, ...(persisted as Partial<ComposerState>) }
          if (!MODELS.some((m) => m.id === next.model && m.surface === surface)) next.model = firstModel(surface)
          return next
        },
      },
    ),
  )
}

export const useImageComposer = createComposer("image")
export const useVideoComposer = createComposer("video")

export function composerFor(surface: Surface) {
  return surface === "image" ? useImageComposer : useVideoComposer
}

/** Call once in a studio: restores the persisted composer after hydration. */
export function rehydrateComposer(surface: Surface) {
  void composerFor(surface).persist.rehydrate()
}
