# NEXUS STUDIO

A private AI creation platform for an agency team. Every image, video and text model runs through
**one Higgsfield API account**, so the team gets one interface and one bill instead of many subscriptions.

Three workspaces:

| Workspace | What it does |
|---|---|
| **Super Computer** | You describe what you want in chat. An agent plans the steps, picks the models and runs the whole pipeline. |
| **Video Studio** | Text or image to video, start and end frames, references, video edit and extend |
| **Image Studio** | Text to image and image references |

Around the workspaces: a **Library**, team **Projects**, a **Prompt library**, a **Usage and costs** dashboard with
budgets, and team **Settings** (members, roles, daily caps, and which models are on, their defaults and costs).

> The platform name lives in `lib/config.ts` (`APP_NAME`). Change it there to rename the app everywhere.

---

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, auth, layout, sidebar, theme, i18n/RTL | ✅ Done |
| 2 | Higgsfield client, model catalog, jobs table, polling, cancel, uploads, storage copy | ✅ Done (webhooks not wired, see below) |
| 3 | Image Studio (end-to-end) | ✅ Done |
| 4 | Video Studio | ✅ Done |
| 5 | Super Computer (planner, tools, pipeline runner, recipes) | ✅ Done |
| 6 | Library, projects, prompt library, usage dashboard, budgets, team and admin settings | ✅ Done |
| 7 | Docs, database integration tests, deployment guide | ✅ Done |

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
2. **Project Settings → API**: copy the project URL and the `anon` (or publishable) key into `.env.local`.
   No service-role key is needed: every query runs as the signed-in user under Row Level Security.
3. **SQL Editor**: run each file in `supabase/migrations/` **once, in order**. You can also use `supabase db push` with the Supabase CLI.

   | File | Creates |
   |---|---|
   | `0001_profiles_teams.sql` | profiles, teams, members, roles, and the sign-up trigger |
   | `0002_jobs_storage.sql` | generations (`jobs`) and the private `outputs` bucket |
   | `0003_recipes.sql` | Super Computer recipes |
   | `0004_team_projects_prompts_usage.sql` | projects, the prompt library, team settings, the usage and budget functions, and the member-management functions |
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (use your production URL later)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
5. **Authentication → Providers → Google**: turn it on and paste a Google OAuth client ID and secret.
   In Google Cloud Console, the authorized redirect URI is `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.

Every new user automatically gets a profile and a personal team with the `owner` role
(see the `handle_new_user` trigger).

**Adding teammates:** each person signs up first. An owner or admin then adds them by e-mail in
**Settings → Members**. After that, their active team switches to the agency team; anyone in several teams
can switch in Settings.

### 2. Higgsfield

Create a key at [open.higgsfield.ai/api-keys](https://open.higgsfield.ai/api-keys). There are two ways to use it:

- **Per user (default):** click **Connect API key** in the sidebar and paste the complete key exactly as copied.
  It goes into an httpOnly cookie through a server action. It is never kept in browser storage, never
  returned to the browser and never logged. The sidebar then shows **API key saved**, and the same dialog
  offers **Replace API key** and **Remove API key**. Saving a key does not prove it is valid; the first
  generation does.
- **Team key (optional):** put the complete key in `HF_API_KEY` on the server. Signed-in team members can then
  generate without pasting their own key, and a user's own key still takes priority. The team key is
  **only used for signed-in users whose e-mail matches `HF_API_KEY_ALLOWED`**, a comma-separated list of
  e-mails and/or `@domains` such as `@theviralempire.agency`. If the list is empty, nobody can use the team key.
  This matters because Supabase allows anyone to sign up by default. For a fully private platform, also turn off
  **Authentication → Sign In / Providers → Allow new users to sign up** after your team has joined.

All platform calls go from the server to `HF_API_BASE_URL` (`https://api.higgsfield.ai`) with
`Authorization: Key <api-key>`.

### 3. Super Computer planner (LLM)

The Super Computer uses an LLM to turn a chat message into a plan. Set this on the server:

| Setup | Env |
|---|---|
| **Claude (recommended)** | `LLM_PROVIDER=anthropic`, `LLM_API_KEY=<Anthropic API key>` (model defaults to `claude-opus-5`; override with `LLM_MODEL`) |
| Any OpenAI-compatible API | `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` |
| No LLM | leave it empty: a basic keyword planner (Arabic + English) still builds plans; script writing and "Enhance prompt" are hidden |

The Claude provider uses the official `@anthropic-ai/sdk` with the following settings:
- Structured output (`messages.parse` + a Zod schema), so the plan always comes back as valid JSON.
- Adaptive thinking.
- A cached, catalog-derived system prompt.
- Server-side refusal fallbacks (`fallbacks: "default"`), so a declined request is retried on Anthropic's recommended model.

## Super Computer

1. **Chat:** describe the job in Arabic or English, e.g. *«اعملي إعلان 15 ثانية لبراند ساعات فخم، 3 لقطات، وصورة بوستر 4:5»*. You can attach images to use as references or start frames.
2. **Plan:** the planner answers with an editable plan card. Each step is `generate_image`, `generate_video` or
   `write_script`. Steps can feed each other, e.g. a keyframe image becomes a video's start frame and a poster's
   reference. Each step shows its model, prompt, settings and inputs, and every one is editable. **Auto** picks the
   first model in catalog order that accepts the step's inputs, and you can override it per step.
3. **Validation:** the LLM's output is untrusted. `lib/supercomputer/plan.ts` checks it against the installed
   catalog before anything is shown:
   - Only known tools and models are kept (anything else falls back to Auto).
   - Settings must be within each model's schema, and ratios snap to the nearest supported one.
   - Inputs may only point at earlier image steps or real uploads.
   - A plan has at most 8 steps.
4. **Run all:** runs steps in dependency order, starting independent steps in parallel. It uses the same
   submit → poll → cancel path as the studios, so jobs appear in the jobs tray, the studios and the library with
   the same duplicate protection.
   - **Stop** cancels queued jobs on Higgsfield.
   - Failed or skipped steps have a **Retry step** button.
   - Reloading the page resumes a running plan and re-attaches to in-flight jobs; they are never submitted twice.
5. **Recipes:** **Save as recipe** stores the pipeline (without results) in the `recipes` table, or in the browser
   in preview mode. Pick one from the side panel to run it again.

Chats are kept per browser (localStorage). The generations they create are stored like any other job.
With an LLM configured, the studios also get **✨ Enhance prompt**.

Not available in this workspace (no matching models in the installed catalog): upscaling, lip-sync and audio.
The planner says so if asked. Cost estimates are not shown because model pricing could not be verified.

## Team, projects, prompts and usage

| Area | What it does |
|---|---|
| **Roles** | `owner`, `admin` and `member`. Owners and admins manage members, the budget and model settings. Only owners can add or remove owners, and a team always keeps at least one owner. |
| **Projects** | Team-shared folders. Pick a project in the studio before generating, or file any generation later with the folder icon on its tile. Teammates see everything filed in a project, but only the creator can poll, cancel or delete their own generation. Unfiled generations stay private. |
| **Prompt library** | 20 starter prompts (ads, UGC, product, cinematic, fashion), each in Arabic and English, plus the team's saved prompts. **Use** loads a prompt into the matching studio; **Save prompt** is also available in the studio composer. |
| **Model settings** | Turn models on or off for the team: disabled models disappear from the pickers and Auto mode, and the server rejects them. Set the default model per studio, and the **credit cost** per generation and per second of video. |
| **Budgets** | A monthly team budget and per-member daily caps, both in credits. **Every submit is checked on the server** against the estimated cost: a request that would exceed a limit is blocked before anything is sent to Higgsfield. A banner appears from 80%. |
| **Usage** | Credits or generations per day, plus breakdowns by model, project and member. Admins see the whole team; members see only their own usage. |

> **About costs:** Higgsfield pricing could not be verified from this environment, so the platform does not guess
> it. Enter each model's credit cost in **Settings → Models**, copied from your Higgsfield dashboard. Until you do,
> generations are counted but show 0 credits, and budgets and caps cannot block anything.

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
- The database layer (migrations, RLS, functions, sign-up, storage copy) and the full app flow were tested against a
  **local Supabase stack**. Everything that talks to Higgsfield or Claude was tested against local mocks of their APIs.

## Environment variables

| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server (protected by RLS) | No |
| `HF_API_BASE_URL` | Server only, `https://api.higgsfield.ai` | No |
| `HF_API_KEY` | Optional team key (server only) | **Yes** |
| `HF_API_KEY_ALLOWED` | Who may use the team key: e-mails and/or `@domains` (empty = nobody) | No |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Super Computer planner and Enhance prompt (server only) | **Yes** |

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
  supercomputer/       Chat thread, input, plan card, step card, side panel
  projects/ prompts/ usage/ settings/   Phase 6 screens
  studio/              Composer, model picker, references, settings, feed, tiles, key dialog, library
  layout/              Sidebar, mobile drawer, topbar, jobs tray, command palette
  ui/                  Button, Input, Card, Badge, Dropdown, Tooltip
i18n/                  Locale config (cookie-based, ar default) + setLocale action
messages/              ar.json, en.json
lib/
  llm/                 Planner providers: anthropic (SDK), openai-compatible, builtin
  supercomputer/       Plan schema + validation, system prompt, actions, runner, chat store
  studio/              Runs controller (submit / poll / cancel), media-role helpers
  team/                Active team context, roles, model settings, cost estimates (server + client hook)
  projects/ prompts/ usage/   Server actions (+ the 20 starter prompts)
  config.ts            APP_NAME + feature flags
  nav.ts               Navigation, the single source for sidebar and palette
  supabase/            Browser, server and middleware clients
supabase/migrations/   SQL schema with RLS (0001–0004)
tests/                 Unit tests; tests/db/ = Supabase integration test
middleware.ts          Session refresh + auth guard
```

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘1` / `⌘2` / `⌘3` | Super Computer / Video Studio / Image Studio |

## Deploy to Vercel

1. Push the repo to GitHub, then choose **Import Project** in Vercel. The framework (Next.js) is detected automatically.
2. Add every variable from `.env.example` under **Settings → Environment Variables**. `NEXT_PUBLIC_*` values are
   baked in at build time, so redeploy after changing them.
3. Add `https://YOUR-DOMAIN/auth/callback`
   to the Supabase redirect URLs (and to Google OAuth if you use it).
4. Run the four migrations on the production Supabase project (see *Local setup → Supabase*).
5. Sign up as the first user; you are the owner of your team. In **Settings**, rename the team, set the budget,
   enter the model costs and add your teammates.

## Testing

| Command | What it covers |
|---|---|
| `npm test` | Unit tests: catalog mappings, API-key handling, upload contract, media roles, error codes, plan normalization, Auto model selection, keyword planner |
| `npm run test:db` | Integration test against a **local** Supabase. It checks: sign-up bootstrap, invites, role guards, last-owner protection, settings write access, project sharing, private vs shared generations, usage scopes, budget/cap math and prompt permissions |
| `npm run typecheck`, `npm run lint`, `npm run build` | Static checks |

To run the database test locally, start Supabase first:

```bash
npx supabase start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0001_profiles_teams.sql   # …then 0002, 0003, 0004
SUPABASE_URL=http://127.0.0.1:54321 ANON=<anon key from `npx supabase status`> npm run test:db
```

Never point `test:db` at production: it creates test users.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # unit tests: catalog, credentials, uploads, studio, planner
npm run test:db    # security + budget integration test against a LOCAL Supabase (see tests/db/)
npm run models     # regenerate the model barrel
```
