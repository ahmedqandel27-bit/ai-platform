"use client"

import { create } from "zustand"

import type { Run } from "../run-types"

/**
 * All generations visible to this user (both studios + jobs tray).
 * Source of truth: Supabase `jobs` when configured, else browser-local
 * storage (see `lib/studio/runs-controller.ts`).
 */
type RunsState = {
  runs: Run[]
  hydrated: boolean
  setAll: (runs: Run[]) => void
  upsert: (run: Run) => void
  patch: (id: string, patch: Partial<Run>) => void
  remove: (id: string) => void
}

export const useRunsStore = create<RunsState>()((set) => ({
  runs: [],
  hydrated: false,
  setAll: (runs) => set({ runs: [...runs].sort((a, b) => b.createdAt - a.createdAt), hydrated: true }),
  upsert: (run) =>
    set((state) => {
      const rest = state.runs.filter((r) => r.id !== run.id)
      return { runs: [run, ...rest].sort((a, b) => b.createdAt - a.createdAt) }
    }),
  patch: (id, patch) =>
    set((state) => ({ runs: state.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  remove: (id) => set((state) => ({ runs: state.runs.filter((r) => r.id !== id) })),
}))
