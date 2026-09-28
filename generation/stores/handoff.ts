"use client"

import { create } from "zustand"

import type { MediaItem, Surface } from "../catalog/types"
import { composerFor } from "./composer"

export type ComposerInput = {
  model: string
  prompt: string
  settings?: Record<string, unknown>
  media: MediaItem[]
}

/**
 * Cross-screen hand-off into a studio composer (Remix, Animate this).
 * If the target composer has not rehydrated yet, the input waits here and the
 * studio applies it after rehydration, so persisted state cannot overwrite it.
 */
const usePending = create<Partial<Record<Surface, ComposerInput>>>()(() => ({}))

export function loadIntoComposer(surface: Surface, input: ComposerInput) {
  const store = composerFor(surface)
  if (store.persist.hasHydrated()) apply(surface, input)
  else usePending.setState({ [surface]: input })
}

/** Called by a studio once its composer has rehydrated. */
export function applyPendingHandoff(surface: Surface) {
  const input = usePending.getState()[surface]
  if (!input) return
  usePending.setState({ [surface]: undefined })
  apply(surface, input)
}

function apply(surface: Surface, input: ComposerInput) {
  const state = composerFor(surface).getState()
  state.load({
    model: input.model,
    prompt: input.prompt,
    media: input.media,
    settings: input.settings ?? state.settingsByModel[input.model] ?? {},
  })
}
