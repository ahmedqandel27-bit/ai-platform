/**
 * Public (browser-safe) environment values.
 * Server-only secrets (Higgsfield keys, service role key) are read directly
 * in server modules and must never be imported here.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

/**
 * When Supabase is not configured yet the app runs in "preview mode":
 * auth is skipped so the UI can be explored locally. Never deploy like this.
 */
export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
