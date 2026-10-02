/**
 * Global app configuration.
 * Rename the platform by changing APP_NAME — it is used everywhere in the UI.
 */
export const APP_NAME = "The Viral Empire";
export const APP_TAGLINE = "Every top AI model. One studio.";

/**
 * Text limits. Generation prompts can be very long (Higgsfield models may
 * still cap what they accept; their error is shown on the tile). Chat
 * messages to the Super Computer can carry whole briefs and scripts.
 */
export const MAX_PROMPT_CHARS = 20_000;
export const MAX_MESSAGE_CHARS = 50_000;

/** Feature flags — flip here, no code changes elsewhere. */
export const FEATURES = {
  /** Lets admins set a markup % for reselling access to clients (Phase 6). */
  resellerMarkup: false,
} as const;
