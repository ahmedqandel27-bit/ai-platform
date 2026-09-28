"use client"

import { create } from "zustand"

/** Lets any screen open the key dialog (e.g. after a missing-key error). */
export const useKeyDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
