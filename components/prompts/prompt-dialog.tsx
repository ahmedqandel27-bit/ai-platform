"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MAX_PROMPT_CHARS } from "@/lib/config";
import { savePrompt, type SavedPrompt } from "@/lib/prompts/actions";
import { useLocalPrompts } from "@/lib/prompts/local-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export const PROMPTS_QUERY = ["prompts"] as const;

export type PromptDraft = { id?: string; title: string; body: string; tags: string[]; surface: SavedPrompt["surface"] };

/** Create / edit a saved prompt (team library, or this browser in preview mode). */
export function PromptDialog({ draft, onClose }: { draft: PromptDraft | null; onClose: () => void }) {
  const t = useTranslations("prompts");
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PromptDraft>({ title: "", body: "", tags: [], surface: "any" });
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draft) {
      setForm(draft);
      setTags(draft.tags.join(", "));
    }
  }, [draft]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      title: form.title,
      body: form.body,
      surface: form.surface,
      tags: tags
        .split(/[,،]/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
    };
    const result = await savePrompt(payload);
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    if (result.data === null) {
      useLocalPrompts.getState().upsert({
        id: form.id ?? crypto.randomUUID(),
        title: payload.title.trim(),
        body: payload.body.trim(),
        tags: payload.tags,
        surface: payload.surface,
        createdAt: Date.now(),
        mine: true,
      });
    }
    await queryClient.invalidateQueries({ queryKey: PROMPTS_QUERY });
    toast.success(t("saved"));
    onClose();
  };

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("close")} className="max-w-lg">
        <DialogTitle>{form.id ? t("edit") : t("new")}</DialogTitle>
        <DialogDescription>{t("dialogHint")}</DialogDescription>
        <form onSubmit={onSave} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prompt-title">{t("title")}</Label>
            <Input id="prompt-title" dir="auto" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prompt-body">{t("body")}</Label>
            <Textarea id="prompt-body" dir="auto" required rows={6} maxLength={MAX_PROMPT_CHARS} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-tags">{t("tags")}</Label>
              <Input id="prompt-tags" dir="auto" value={tags} placeholder="ads, watch, 9:16" onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-surface">{t("surface")}</Label>
              <NativeSelect id="prompt-surface" value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value as PromptDraft["surface"] })}>
                <option value="any">{t("any")}</option>
                <option value="image">{t("image")}</option>
                <option value="video">{t("video")}</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !form.title.trim() || !form.body.trim()}>
              {saving && <Loader2 className="animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
