import "server-only"

import { cookies } from "next/headers"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { MissingCredentialsError, PLATFORM_KEY_COOKIE, decodeCredentials } from "./credentials"

export const DEFAULT_API_BASE_URL = "https://api.higgsfield.ai"

export type CredentialSource = "user" | "team"

/** Who is making the request. `userId` is null only in preview mode (no Supabase). */
export type Viewer = { userId: string | null }

export async function getViewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured) return { userId: null }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { userId: user.id } : null
}

function teamKey(): string | null {
  const key = process.env.HF_API_KEY?.trim()
  return key ? key : null
}

/**
 * The shared team key (`HF_API_KEY`) is only ever used for signed-in users, so
 * every request it pays for is attributable and ownership can be enforced.
 * In preview mode (no auth) only a key the visitor pasted themselves works.
 */
export function teamKeyAvailable(viewer: Viewer | null): boolean {
  return Boolean(teamKey() && isSupabaseConfigured && viewer?.userId)
}

export async function readUserKey(): Promise<string | null> {
  const jar = await cookies()
  return decodeCredentials(jar.get(PLATFORM_KEY_COOKIE)?.value)?.apiKey ?? null
}

/** Resolves the key for a platform call: the viewer's own key first, then the team key. */
export async function resolveCredentials(viewer: Viewer | null): Promise<{
  apiKey: string
  baseUrl: string
  source: CredentialSource
}> {
  const baseUrl = process.env.HF_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
  const userKey = await readUserKey()
  if (userKey) return { apiKey: userKey, baseUrl, source: "user" }
  const shared = teamKey()
  if (shared && teamKeyAvailable(viewer)) return { apiKey: shared, baseUrl, source: "team" }
  throw new MissingCredentialsError()
}
