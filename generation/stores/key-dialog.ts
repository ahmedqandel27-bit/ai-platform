"use client"

import { create } from "zustand"

/**
 * Lets any screen open the key dialog (e.g. after a missing-key error).
 * `lastRejection` is Higgsfield's latest reason for rejecting the key, shown
 * inside the dialog so it is visible even though the dialog covers the feed.
 */
export const useKeyDialog = create<{
  open: boolean
  lastRejection: string | null
  setOpen: (open: boolean) => void
  reject: (reason: string) => void
  clearRejection: () => void
}>()((set) => ({
  open: false,
  lastRejection: null,
  setOpen: (open) => set({ open }),
  reject: (reason) => set({ open: true, lastRejection: reason }),
  clearRejection: () => set({ lastRejection: null }),
}))
