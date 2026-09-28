/**
 * Public (browser-safe) environment values.
 * Server-only secrets (Higgsfield keys, LLM keys) are read directly in server
 * modules and must never be imported here.
 */

/**
 * The Supabase client needs the bare project URL (https://<ref>.supabase.co).
 * A commonly pasted variant is the REST URL (…/rest/v1/) or a trailing slash;
 * with a path, sign-in links become …/rest/v1/auth/v1/authorize and the
 * Supabase gateway answers "No API key found in request". Keep only the origin.
 */
export function normalizeSupabaseUrl(value: string | undefined): string {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  try {
    return new URL(raw).origin
  } catch {
    return raw.replace(/\/+$/, "")
  }
}

export const publicEnv = {
  supabaseUrl: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
};

/**
 * When Supabase is not configured yet the app runs in "preview mode":
 * auth is skipped so the UI can be explored locally. Never deploy like this.
 */
export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
