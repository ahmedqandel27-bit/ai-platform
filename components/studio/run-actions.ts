"use client";

import { MODELS } from "@/generation/catalog";
import type { Run } from "@/generation/run-types";
import { composerFor } from "@/generation/stores/composer";
import { loadIntoComposer } from "@/generation/stores/handoff";

/** Loads a run's inputs back into its studio composer. */
export function remix(run: Run) {
  const known = MODELS.some((m) => m.id === run.model && m.surface === run.surface);
  loadIntoComposer(run.surface, {
    model: known ? run.model : composerFor(run.surface).getState().model,
    prompt: run.prompt,
    ...(known ? { settings: run.settings } : {}),
    media: run.media,
  });
}

/** Sends an image to Video Studio as the start frame. */
export function animate(imageUrl: string, prompt: string) {
  const current = MODELS.find((m) => m.id === composerFor("video").getState().model);
  const model = current?.roles.start ? current : MODELS.find((m) => m.surface === "video" && m.roles.start);
  if (!model) return;
  loadIntoComposer("video", {
    model: model.id,
    prompt,
    media: [{ id: crypto.randomUUID(), url: imageUrl, role: "start", kind: "image" }],
  });
}
