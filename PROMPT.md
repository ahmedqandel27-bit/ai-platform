# برومت بناء المنصة — AI Studio مربوطة على Higgsfield API

> **طريقة الاستخدام:** انسخ البرومت اللي تحت (الجزء الإنجليزي بالكامل) والصقه في أداة البناء اللي بتستخدمها
> (Lovable / Bolt / v0 / Cursor / Claude Code). البرومت مكتوب إنجليزي لأن أدوات البناء بتفهمه أدق،
> لكن الواجهة نفسها هتطلع عربي + إنجليزي.
>
> **قبل ما تبدأ:** هات الـ API Key والـ Secret من لوحة Higgsfield (Cloud / API) وحطهم في متغيرات البيئة
> على السيرفر فقط — **ما تحطهمش أبداً في كود الواجهة**.

---

```text
You are a senior full-stack engineer and product designer. Build a production-ready web platform
called "NEXUS STUDIO" (placeholder name — keep it in one config constant so I can rename it).

## 1. Goal
A private, premium AI creation platform for me and my agency team. All generation runs through
the Higgsfield API (one account, one bill, pay-per-use) so we stop paying for many separate
subscriptions. It exposes the strongest image, video and text models in ONE clean interface,
split into three workspaces:

  1. SUPER COMPUTER  — an all-in-one "command center" / AI agent
  2. VIDEO STUDIO    — video generation only
  3. IMAGE STUDIO    — image generation and editing only

## 2. Tech stack
- Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui + Framer Motion
- Supabase: Postgres, Auth (email + Google), Storage (for uploads and saved outputs)
- Zustand for client state, TanStack Query for server state and polling
- Zod for validating every request/response
- Deployable to Vercel. Provide `.env.example`.

## 3. Higgsfield integration (MOST IMPORTANT — do this carefully)
- ALL calls to Higgsfield happen server-side only (Next.js Route Handlers / Server Actions).
  The API key and secret live in env vars: HIGGSFIELD_API_KEY, HIGGSFIELD_API_SECRET.
  Never expose them to the browser, never log them.
- Read the official Higgsfield API docs for the exact base URL, auth header format, endpoint
  paths, request fields and status values. Do NOT invent endpoints. Put every endpoint URL and
  model id in ONE file: `lib/higgsfield/models.ts` so I can update them without touching UI code.
- Create a typed client `lib/higgsfield/client.ts` with:
    submitGeneration(modelId, params) -> { requestId }
    getStatus(requestId)              -> { status, progress?, outputs?, error? }
    cancel(requestId)
    uploadMedia(file)                 -> { url | mediaId }   (for image-to-video, references, edits)
- Generation is ASYNC: submit -> store a `jobs` row -> poll status (every 3–5s with backoff) OR
  receive the webhook at `/api/webhooks/higgsfield` (verify signature if supported) -> when done,
  copy the output file into Supabase Storage so links never expire -> update the job row.
- Wrap it behind a provider interface `AIProvider` so another provider can be added later
  without changing the UI (Higgsfield is the default and only provider for now).
- Robust error handling: retries with exponential backoff on 429/5xx, clear user-facing messages
  for content-policy rejections, insufficient credits, and timeouts.

## 4. Model registry (data-driven UI)
Each model in `models.ts` is an object:
  { id, label, provider: "higgsfield", category: "image" | "video" | "text" | "audio" | "edit",
    capabilities: ["text-to-image","image-to-image","text-to-video","image-to-video",
                   "start-end-frame","lip-sync","upscale","inpaint", ...],
    params: Zod schema (aspect ratios, durations, resolution, seed, motion strength, etc.),
    costEstimate: credits per run (or per second), speedTag: "fast" | "quality",
    badge?: "NEW" | "BEST" | "CHEAP" }
The UI builds its forms automatically from this registry — adding a model = adding one object.
Pre-fill it with the top image & video models that Higgsfield currently offers (e.g. their
Soul / Nano Banana / Seedream / Flux-class image models and Kling / Veo / Seedance / Wan /
Minimax-class video models, plus Higgsfield motion presets & upscalers) — verify the real ids
from the docs and mark anything uncertain with a TODO.

## 5. Workspace 1 — SUPER COMPUTER (the "brain")
A chat-style command center, like ChatGPT + an agent that can create media:
- Big chat panel. The user writes in Arabic or English in natural language, e.g.
  "اعملي إعلان 15 ثانية لبراند ساعات فخم، 3 لقطات، وصورة بوستر 4:5".
- A planner (LLM via the Higgsfield text/LLM endpoint if available; otherwise a pluggable
  `LLM_PROVIDER` env with an OpenAI-compatible or Anthropic client) turns the request into a
  step-by-step PLAN shown as editable cards: [enhance prompt] -> [generate image] ->
  [image-to-video] -> [upscale] ...  Each card shows chosen model, params and estimated cost.
- "Run all" executes the pipeline; results stream back into the chat as they finish.
- Tools the agent can call: generate_image, generate_video, edit_image, upscale,
  enhance_prompt, write_script (hooks, captions, storyboard), analyze_uploaded_media.
- Auto model selection ("Auto" mode picks the best model for the task and budget) with a
  manual override dropdown.
- Side panel: session assets, running jobs, total cost of this session.
- Saved "Recipes": save any pipeline as a reusable template (e.g. "Product ad 9:16").

## 6. Workspace 2 — VIDEO STUDIO
- Modes (tabs): Text→Video · Image→Video · Start/End Frame · Motion presets / camera moves ·
  Lip-sync / talking avatar · Video upscale.
- Left panel: model picker (cards with badge, speed, cost), prompt box with
  "✨ Enhance prompt" button, negative prompt, aspect ratio (16:9, 9:16, 1:1, 4:5),
  duration, resolution, seed, camera-motion chips, drag-and-drop reference upload.
- Center: large player with the latest result; compare mode (A/B side by side).
- Bottom: timeline-style history of generations for this project; hover to preview.
- Actions per result: download, regenerate, remix (reuse settings), extend, upscale,
  send to Super Computer, add to project.
- Batch: generate the same prompt on up to 4 models at once to compare.

## 7. Workspace 3 — IMAGE STUDIO
- Modes: Text→Image · Image→Image / style reference · Character consistency (reference
  face/product) · Edit (inpaint / outpaint / remove background) · Upscale.
- Same layout pattern as Video Studio (left controls / center canvas / history).
- Masonry gallery grid of results, number of images per run (1–4), aspect ratios, seed.
- One-click "Animate this" -> sends the image to Video Studio as the start frame.

## 8. Shared features
- Projects & folders; every asset stores its full prompt + model + params + cost (reproducible).
- Global Library page with filters (type, model, project, date, favorites) and search.
- Prompt library: save / tag / reuse prompts; ship 20 starter prompts (ads, UGC, product shots,
  cinematic, fashion) in Arabic and English.
- Jobs tray (top-right) showing queued / running / done / failed jobs with progress.
- Credits & cost dashboard: spend per day / model / project / team member, with a monthly
  budget limit and warning at 80%. Show estimated cost BEFORE every generation.
- Team: roles Owner / Admin / Member, per-member daily spending cap.
- Admin settings page: enable/disable models, set default model per mode, set markup if
  I later resell access to clients (keep this behind a feature flag).

## 9. Database (Supabase) — with Row Level Security on every table
profiles, teams, team_members, projects, jobs (id, user_id, project_id, workspace, model_id,
params jsonb, status, provider_request_id, cost, error, created_at, finished_at),
assets (id, job_id, type, storage_path, width, height, duration, prompt, favorite),
prompts, recipes, usage_ledger (every credit spent), settings.

## 10. Design / UI
- Dark, premium, futuristic look (think Higgsfield / Runway / Linear): near-black background,
  subtle glassmorphism panels, one electric accent color (violet→cyan gradient), smooth
  Framer Motion transitions, skeleton shimmer while generating.
- Left sidebar navigation: Super Computer · Video Studio · Image Studio · Library · Projects ·
  Prompts · Usage · Settings.
- Full RTL support + Arabic/English language toggle (next-intl). Arabic font: "IBM Plex Sans
  Arabic" or "Cairo"; English: "Inter".
- Fully responsive (usable on mobile), keyboard shortcuts (⌘K command palette,
  ⌘Enter = generate).

## 11. Security & reliability
- Keys only on the server; rate-limit API routes per user; validate all inputs with Zod.
- Check the user's budget/credits server-side before submitting any job.
- Uploaded files: type/size validation, stored in private buckets, signed URLs.
- Idempotency key per submit so double-clicks don't pay twice.

## 12. Deliverables & order of work
1. Project scaffold, auth, layout, sidebar, theme, i18n/RTL.
2. Higgsfield client + model registry + jobs table + polling/webhook + storage copy.
3. Image Studio (end-to-end working first).
4. Video Studio.
5. Super Computer (planner + tools + pipeline runner).
6. Library, projects, prompts, usage dashboard, team & admin settings.
7. README with setup steps, env vars, how to add a new model, and how to deploy on Vercel.

Write clean, modular, commented code. After each phase, stop and summarize what was built
and what I need to configure. Ask me before adding any paid third-party service.
```

---

## نصايح سريعة لتوفير الفلوس

- **فعّل "Estimated cost" قبل كل توليد** — هتفرق جداً مع موديلات الفيديو الغالية.
- **اعمل الـ Drafts على موديل سريع/رخيص** وبعد ما توصل للفكرة الصح اعمل الـ Final على الموديل الأقوى.
- **Batch compare** استخدمه بحساب — 4 موديلات = 4 أضعاف التكلفة.
- **حط Budget شهري وحد يومي لكل عضو في التيم** من صفحة Usage.
