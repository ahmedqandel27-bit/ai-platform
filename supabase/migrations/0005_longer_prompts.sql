-- ─────────────────────────────────────────────────────────────
-- Longer prompts: the prompt library accepts up to 20,000 characters
-- (matches MAX_PROMPT_CHARS in lib/config.ts).
-- ─────────────────────────────────────────────────────────────

alter table public.prompts drop constraint if exists prompts_body_check;
alter table public.prompts
  add constraint prompts_body_check check (char_length(body) between 1 and 20000);
