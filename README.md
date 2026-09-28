# NEXUS STUDIO

A private AI creation platform for an agency team. Every image, video and text model runs through
**one Higgsfield API account**, so the team gets one interface and one bill instead of many subscriptions.

Three workspaces:

| Workspace | What it does |
|---|---|
| **Super Computer** | You describe what you want in chat. An agent plans the steps, picks the models, runs the whole pipeline and shows the cost. |
| **Video Studio** | Text/image to video, start and end frames, camera moves, lip-sync and upscaling |
| **Image Studio** | Text to image, style and character references, editing and upscaling |

> The platform name lives in `lib/config.ts` (`APP_NAME`). Change it there to rename the app everywhere.

---

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, auth, layout, sidebar, theme, i18n/RTL | ✅ Done |
| 2 | Higgsfield client, model catalog, jobs table, polling, cancel, uploads, storage copy | ✅ Done (webhooks not wired, see below) |
| 3 | Image Studio (end-to-end) | ✅ Done |
| 4 | Video Studio | ✅ Done |
| 5 | Super Computer (planner, tools, pipeline runner) | ⏳ Next |
| 6 | Library ✅, projects, prompts, usage dashboard, team and admin settings | Partly done |
| 7 | Final docs and deployment guide | — |

## Tech stack

Next.js 15 (App Router), TypeScript (strict), Tailwind CSS v4, shadcn-style UI components, Framer Motion,
Supabase (Postgres, Auth, Storage), Zustand, TanStack Query, Zod and next-intl.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values (see below)
npm run dev                  # http://localhost:3000
```

If the Supabase variables are empty, the app starts in **preview mode**. Sign-in is turned off and a yellow
banner is shown, so you can look around the UI before setting anything up. Never deploy in preview mode.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy the URL, the `anon` key and the `service_role` key into `.env.local`.
3. **SQL Editor**: run each file in `supabase/migrations/` in order. You can also use `supabase db push` with the Supabase CLI.
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (use your production URL later)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
5. **Authentication → Providers → Google**: turn it on and paste a Google OAuth client ID and secret.
   In Google Cloud Console, the authorized redirect URI is `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.

Every new user automatically gets a profile and a personal team with the `owner` role
(see the `handle_new_user` trigger).

Then run `supabase/migrations/0002_jobs_storage.sql` too. It creates the `jobs` table and the private `outputs` bucket.

### 2. Higgsfield

Create a key at [open.higgsfield.ai/api-keys](https://open.higgsfield.ai/api-keys). There are two ways to use it:

- **Per user (default):** click **Connect API key** in the sidebar and paste the complete key exactly as copied.
  It goes into an httpOnly cookie through a server action. It is never kept in browser storage, never
  returned to the browser and never logged. The sidebar then shows **API key saved**, and the same dialog
  offers **Replace API key** and **Remove API key**. Saving a key does not prove it is valid; the first
  generation does.
- **Team key (optional):** put the complete key in `HF_API_KEY` on the server. Signed-in team members can then
  generate without pasting their own key, and a user's own key still takes priority. The team key is
  **only used when Supabase auth is configured**, so every paid request is tied to a signed-in user.

All platform calls go from the server to `HF_API_BASE_URL` (`https://api.higgsfield.ai`) with
`Authorization: Key <api-key>`.

## How generation works

```
Browser                 Next.js server (actions.ts)                 Higgsfield
───────                 ───────────────────────────                 ──────────
Generate ─────────────▶ validate against catalog
                        insert jobs row (owner + idempotency key)
                        POST /<model-path> ───────────────────────▶ { request_id }
poll every 4s (batched) ▶ ownership check → GET /requests/<id>/status ▶ queued → in_progress → completed | failed | nsfw | canceled
Cancel ───────────────▶ ownership check → POST /requests/<id>/cancel
                        on completed: copy media → Supabase Storage (outputs/<user>/<job>/…)
Reference upload ─────▶ /api/upload → POST /files/generate-upload-url → signed ticket
browser PUTs the file straight to upload_url (no credentials), then uses public_url
```

- **Duplicate protection:** the Generate button locks while submitting, every submit carries a client id,
  and the database has a `unique (user_id, client_id)` constraint. A replayed or double-clicked submit is
  never sent twice.
- **No blind retries:** if a submit times out or loses its connection, the run is marked "unclear whether this
  reached Higgsfield" and is never re-sent automatically. Status polling backs off on errors and 429s.
- **Failed, blocked (`nsfw`) and canceled runs** stay visible in the feed until you delete them.
- **History:** with Supabase configured, history lives in the `jobs` table and outputs are copied into the private
  `outputs` bucket (served as 1-hour signed URLs). In preview mode it lives in this browser's localStorage.

## Models

The catalog comes from the official [Higgsfield app templates](https://github.com/higgsfield-ai/app-templates)
registry. It has one file per model in `generation/catalog/models/` (38 models: 8 image, 30 video).
`scripts/sync-models.mjs` regenerates `generation/catalog/models.generated.ts` on every `dev`/`build`.
**Never edit that generated file by hand.**

```bash
pnpm dlx shadcn@latest list higgsfield-ai/app-templates          # discover models
pnpm dlx shadcn@latest add higgsfield-ai/app-templates/<model>   # add one (lands in generation/catalog/models/)
```

Each model file declares its endpoint path(s), accepted media roles (reference, start and end frames, video,
audio, source) and settings (`enum`, `range` or `boolean`). The studio renders its picker, uploader and
settings from these files, so a new model file is all it takes to add a model.

### Verification status

- The request and response contract (submit, status, cancel, signed upload) and every model mapping come from the
  official template registry (commit `9288d98`, 2026-09-26). Its unit tests are included and pass.
- `docs.higgsfield.ai`, `open.higgsfield.ai` and `api.higgsfield.ai` were **not reachable** from the build
  environment. The mappings have not been checked against the live docs, and **no call was made with a real key**.
  The full flow was tested against a local mock of the documented contract.
- Assumed, not verified: HTTP 402 means "insufficient credits", and `cancel` only succeeds while a request is queued.
- **Webhooks are not implemented** because their signing scheme could not be verified. Status comes from polling.

## Environment variables

| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server (protected by RLS) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: job worker and webhook | **Yes** |
| `NEXT_PUBLIC_SITE_URL` | OAuth redirects and webhooks | No |
| `HF_API_BASE_URL` | Server only, `https://api.higgsfield.ai` | No |
| `HF_API_KEY` | Optional team key (server only, used only for signed-in users) | **Yes** |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Super Computer planner (Phase 5) | **Yes** |

## Project structure

```
app/
  (auth)/login/        Sign-in and sign-up (email + Google)
  (app)/               Authenticated workspace: sidebar, topbar, ⌘K palette
    super-computer/  video/  image/  library/  projects/  prompts/  usage/  settings/
  auth/callback/       OAuth / email-confirm code exchange
  auth/signout/        POST → sign out
  api/upload/          Signed reference-upload tickets
generation/
  catalog/             Model catalog (one file per model), mappers, media-role rules
  actions.ts           Server actions: key, submit, batched status, cancel, history
  platform.ts          Higgsfield REST client (Authorization: Key …)
  poll.ts              Client batched poller with backoff
  jobs-repo.ts         Supabase persistence + ownership checks
  storage-copy.ts      Copies finished media into Supabase Storage
components/
  studio/              Composer, model picker, references, settings, feed, tiles, key dialog, library
  layout/              Sidebar, mobile drawer, topbar, jobs tray, command palette
  ui/                  Button, Input, Card, Badge, Dropdown, Tooltip
i18n/                  Locale config (cookie-based, ar default) + setLocale action
messages/              ar.json, en.json
lib/
  config.ts            APP_NAME + feature flags
  nav.ts               Navigation, the single source for sidebar and palette
  supabase/            Browser, server and middleware clients
supabase/migrations/   SQL schema with RLS
middleware.ts          Session refresh + auth guard
```

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘1` / `⌘2` / `⌘3` | Super Computer / Video Studio / Image Studio |

## Deploy to Vercel

1. Push the repo to GitHub, then choose **Import Project** in Vercel.
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
3. Set `NEXT_PUBLIC_SITE_URL` to your production domain, and add `https://YOUR-DOMAIN/auth/callback`
   to the Supabase redirect URLs.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # node --test (catalog, credentials, uploads, studio logic)
npm run models     # regenerate the model barrel
```
