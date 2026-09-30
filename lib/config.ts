/**
 * Global app configuration.
 * Rename the platform by changing APP_NAME — it is used everywhere in the UI.
 */
export const APP_NAME = "The Viral Empire";
export const APP_TAGLINE = "Every top AI model. One studio.";

/** Feature flags — flip here, no code changes elsewhere. */
export const FEATURES = {
  /** Lets admins set a markup % for reselling access to clients (Phase 6). */
  resellerMarkup: false,
} as const;
