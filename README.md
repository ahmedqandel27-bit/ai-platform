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
| 2 | Higgsfield client, model registry, jobs table, polling/webhook, storage copy | ⏳ Next |
| 3 | Image Studio (end-to-end) | — |
| 4 | Video Studio | — |
| 5 | Super Computer (planner, tools, pipeline runner) | — |
| 6 | Library, projects, prompts, usage dashboard, team and admin settings | — |
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

### 2. Higgsfield

Add `HIGGSFIELD_API_KEY` and `HIGGSFIELD_API_SECRET` to `.env.local`. They are **server-only**:
never give them a `NEXT_PUBLIC_` prefix. They are wired up in Phase 2.

## Environment variables

| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server (protected by RLS) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: job worker and webhook | **Yes** |
| `NEXT_PUBLIC_SITE_URL` | OAuth redirects and webhooks | No |
| `HIGGSFIELD_API_KEY` / `HIGGSFIELD_API_SECRET` | Server only | **Yes** |
| `HIGGSFIELD_WEBHOOK_SECRET` | Webhook signature check | **Yes** |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Super Computer planner (Phase 5) | **Yes** |

## Project structure

```
app/
  (auth)/login/        Sign-in and sign-up (email + Google)
  (app)/               Authenticated workspace: sidebar, topbar, ⌘K palette
    super-computer/  video/  image/  library/  projects/  prompts/  usage/  settings/
  auth/callback/       OAuth / email-confirm code exchange
  auth/signout/        POST → sign out
components/
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
```
