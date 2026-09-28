import { NextResponse } from "next/server"

import { MissingCredentialsError } from "@/generation/credentials"
import { createPlatformClient, PlatformError } from "@/generation/platform"
import { getViewer, resolveCredentials } from "@/generation/server-credentials"
import { requireUploadContentType } from "@/generation/upload-contract"

/**
 * Returns a signed Higgsfield upload ticket for one reference file.
 * The browser then PUTs the file directly to `upload_url` with the returned
 * headers and no credentials. Signed URLs are never logged.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    return failure(403, "Cross-origin upload requests are not allowed.")

  let contentType: string
  try {
    const body: unknown = await request.json()
    contentType = requireUploadContentType(
      body && typeof body === "object" && "contentType" in body ? body.contentType : null,
    )
  } catch (error) {
    return failure(
      400,
      error instanceof SyntaxError
        ? "Invalid upload request."
        : "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, or WAV.",
    )
  }

  const viewer = await getViewer()
  if (!viewer) return failure(401, "Sign in before uploading.")

  let credentials: Awaited<ReturnType<typeof resolveCredentials>>
  try {
    credentials = await resolveCredentials(viewer)
  } catch (error) {
    if (error instanceof MissingCredentialsError)
      return failure(401, "Connect your Higgsfield API key in the sidebar before uploading.")
    throw error
  }

  try {
    const ticket = await createPlatformClient(credentials).createUpload(contentType)
    return NextResponse.json(ticket, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const status = error instanceof PlatformError ? error.status : 502
    console.error("[upload] Could not prepare reference upload", { status })
    if (status === 401 || status === 403)
      return failure(status, "Higgsfield rejected the API key. Replace it in the sidebar and try again.")
    if (status === 429) return failure(429, "Higgsfield upload rate limit reached. Wait a moment and try again.")
    return failure(502, "Could not prepare the reference upload with Higgsfield. Try again.")
  }
}

function failure(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } })
}
