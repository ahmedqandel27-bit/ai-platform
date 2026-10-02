"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { MAX_MESSAGE_CHARS } from "@/lib/config";
import { useKeyDialog } from "@/generation/stores/key-dialog";
import { uploadMedia } from "@/generation/upload";
import { mediaKindFromMime } from "@/generation/upload-contract";
import type { ChatUploadItem } from "@/lib/supercomputer/store";
import { cn } from "@/lib/utils";

/** Prompt box: Enter sends, Shift+Enter adds a line, files upload through the signed-URL flow. */
export function ChatInput({
  value,
  onChange,
  onSend,
  busy,
  placeholder,
  extra,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string, uploads: ChatUploadItem[]) => void;
  busy: boolean;
  placeholder?: string;
  /** Rendered next to the send button (the thinking-model picker). */
  extra?: React.ReactNode;
}) {
  const t = useTranslations("sc");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<ChatUploadItem[]>([]);
  const [uploading, setUploading] = useState(0);

  const canSend = !busy && uploading === 0 && (value.trim().length > 0 || uploads.length > 0);

  const send = () => {
    if (!canSend) return;
    onSend(value, uploads);
    setUploads([]);
  };

  async function addFiles(files: File[]) {
    for (const file of files) {
      let kind: ChatUploadItem["kind"];
      try {
        kind = mediaKindFromMime(file.type);
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : String(caught));
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const { url } = await uploadMedia(file);
        setUploads((list) => [...list, { url, kind, name: file.name }].slice(0, 8));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        if (/api key/i.test(message)) useKeyDialog.getState().setOpen(true);
        toast.error(message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  return (
    <div
      className="glass rounded-2xl p-2 focus-within:border-accent/50"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addFiles([...e.dataTransfer.files]);
      }}
    >
      {(uploads.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-2 p-1.5">
          {uploads.map((u) => (
            <div key={u.url} className="group relative size-14 overflow-hidden rounded-lg border border-border bg-surface-2">
              {u.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded reference thumbnail
                <img src={u.url} alt={u.name ?? ""} className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-[10px] text-muted">{u.kind}</span>
              )}
              <button
                type="button"
                onClick={() => setUploads((list) => list.filter((x) => x.url !== u.url))}
                className="absolute end-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-black/70 text-white"
                aria-label="Remove"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
          {uploading > 0 && (
            <div className="grid size-14 place-items-center rounded-lg border border-border bg-surface-2">
              <Loader2 className="size-4 animate-spin text-muted" />
            </div>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-white/5 hover:text-foreground"
          aria-label={t("attach")}
          title={t("attach")}
        >
          <Paperclip className="size-4" />
        </button>
        <textarea
          value={value}
          dir="auto"
          rows={1}
          maxLength={MAX_MESSAGE_CHARS}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder ?? t("placeholder")}
          aria-label={placeholder ?? t("placeholder")}
          data-testid="sc-input"
          className="max-h-48 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-relaxed outline-none [field-sizing:content] placeholder:text-muted/70"
        />
        {extra}
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label={t("send")}
          data-testid="sc-send"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl transition",
            canSend ? "bg-gradient-accent text-white" : "bg-white/5 text-muted",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
        onChange={(e) => {
          void addFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
