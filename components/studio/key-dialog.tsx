"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getKeyStatus, removeApiKey, saveApiKey } from "@/generation/actions";
import { useKeyDialog } from "@/generation/stores/key-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const KEY_STATUS_QUERY = ["key-status"] as const;

export function useKeyStatus() {
  return useQuery({ queryKey: KEY_STATUS_QUERY, queryFn: () => getKeyStatus(), staleTime: 60_000 });
}

/**
 * The only place that collects the Higgsfield key. The key goes straight to a
 * server action that stores it in an httpOnly cookie; it is never kept in
 * client state after submit, never returned, never logged.
 */
export function KeyDialog() {
  const t = useTranslations("key");
  const open = useKeyDialog((s) => s.open);
  const setOpen = useKeyDialog((s) => s.setOpen);
  const { data: status } = useKeyStatus();
  const queryClient = useQueryClient();
  const [replacing, setReplacing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasKey = Boolean(status?.userKey);
  const showForm = !hasKey || replacing;

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setReplacing(false);
      setValue("");
      setError(null);
    }
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveApiKey({ apiKey: value });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setValue("");
      await queryClient.invalidateQueries({ queryKey: KEY_STATUS_QUERY });
      toast.success(t("saved"));
      close(false);
    });
  };

  const onRemove = () =>
    startTransition(async () => {
      await removeApiKey();
      await queryClient.invalidateQueries({ queryKey: KEY_STATUS_QUERY });
      toast.success(t("removed"));
      close(false);
    });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={t("close")}>
        <div className="mb-4 grid size-10 place-items-center rounded-xl border border-border-strong bg-surface-2">
          <KeyRound className="size-4 text-accent" />
        </div>
        <DialogTitle>{showForm ? (hasKey ? t("replace") : t("connect")) : t("manage")}</DialogTitle>

        {showForm ? (
          <form onSubmit={onSave} className="mt-2 space-y-4">
            <DialogDescription>Paste the API key copied from open.higgsfield.ai. Paste it as-is.</DialogDescription>
            <div className="space-y-1.5">
              <Label htmlFor="hf-api-key">{t("label")}</Label>
              <Input
                id="hf-api-key"
                type="password"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                required
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
              />
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
            <a
              href="https://open.higgsfield.ai/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              {t("getKey")}
              <ExternalLink className="size-3" />
            </a>
            <div className="flex justify-end gap-2">
              {hasKey && (
                <Button type="button" variant="ghost" onClick={() => setReplacing(false)}>
                  {t("back")}
                </Button>
              )}
              <Button type="submit" disabled={pending || !value.trim()}>
                {pending && <Loader2 className="animate-spin" />}
                {hasKey ? t("replace") : t("connect")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-2 space-y-5">
            <DialogDescription>{t("savedHint")}</DialogDescription>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="danger" onClick={onRemove} disabled={pending}>
                {t("remove")}
              </Button>
              <Button variant="secondary" onClick={() => setReplacing(true)} disabled={pending}>
                {t("replace")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Sidebar row: "Connect API key" / "API key saved" / team key in use. */
export function KeyStatusRow({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations("key");
  const setOpen = useKeyDialog((s) => s.setOpen);
  const { data: status } = useKeyStatus();

  const label = status?.userKey ? t("statusSaved") : status?.teamKey ? t("statusTeam") : t("connect");
  const ready = Boolean(status?.userKey || status?.teamKey);

  return (
    <button
      onClick={() => setOpen(true)}
      title={status?.userKey ? t("manage") : t("connect")}
      className={
        "flex h-10 w-full items-center gap-2.5 rounded-xl border px-3 text-start text-xs transition-colors " +
        (ready
          ? "border-border text-muted hover:border-border-strong hover:text-foreground"
          : "border-accent/40 bg-accent/10 text-foreground hover:bg-accent/15") +
        (collapsed ? " justify-center px-0" : "")
      }
    >
      <span className={"size-2 shrink-0 rounded-full " + (ready ? "bg-success" : "bg-warning")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
