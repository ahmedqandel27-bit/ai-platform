"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AudioLines, Film, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { MediaItem, MediaKind, MediaRole, ModelEntry } from "@/generation/catalog/types";
import { useKeyDialog } from "@/generation/stores/key-dialog";
import { uploadMedia } from "@/generation/upload";
import { mediaKindFromMime } from "@/generation/upload-contract";
import { ACCEPT, acceptedKinds, addMedia, rolesForKind, setRole } from "@/lib/studio/media";
import { cn } from "@/lib/utils";

type Pending = { id: string; name: string; preview: string | null };

/**
 * One mixed reference picker. Files are uploaded through the signed-URL flow
 * (server asks Higgsfield for a ticket, the browser PUTs the bytes with no
 * credentials) and routed to a role the model supports. Each attachment can
 * be re-assigned (reference ↔ start/end frame, source ↔ video reference).
 */
export function References({
  model,
  media,
  onChange,
}: {
  model: ModelEntry;
  media: MediaItem[];
  onChange: (media: MediaItem[]) => void;
}) {
  const t = useTranslations("studio");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  const kinds = acceptedKinds(model);
  // Prompt-only model with nothing attached: nothing to show but a hint.
  if (!kinds.length && !media.length) return <p className="text-xs text-muted">{t("noReferences")}</p>;

  async function handleFiles(files: File[]) {
    for (const file of files) {
      let kind: MediaKind;
      try {
        kind = mediaKindFromMime(file.type);
        if (!rolesForKind(model, kind).length) throw new Error(`${model.label} does not accept ${kind} files.`);
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : String(caught));
        continue;
      }
      const id = crypto.randomUUID();
      const preview = kind === "image" ? URL.createObjectURL(file) : null;
      setPending((p) => [...p, { id, name: file.name, preview }]);
      try {
        const { url } = await uploadMedia(file);
        // Only recorded after the storage PUT succeeded.
        onChange(addMedia(model, mediaRef.current, { id, url, kind, name: file.name }));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        if (/api key/i.test(message)) useKeyDialog.getState().setOpen(true);
        toast.error(message);
      } finally {
        setPending((p) => p.filter((x) => x.id !== id));
        if (preview) URL.revokeObjectURL(preview);
      }
    }
  }

  const changeRole = (id: string, role: MediaRole) => {
    try {
      onChange(setRole(model, media, id, role));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles([...e.dataTransfer.files]);
      }}
      className={cn("space-y-2 rounded-xl transition-colors", dragging && "bg-accent/5 ring-2 ring-accent/40")}
    >
      <div className="flex flex-wrap gap-2">
        {media.map((item) => (
          <Attachment
            key={item.id}
            item={item}
            roles={rolesForKind(model, item.kind ?? "image")}
            unsupported={!(model.roles[item.role] ?? 0)}
            onRole={(role) => changeRole(item.id, role)}
            onRemove={() => onChange(media.filter((m) => m.id !== item.id))}
          />
        ))}
        {pending.map((p) => (
          <div key={p.id} className="relative grid size-20 place-items-center overflow-hidden rounded-xl border border-border bg-surface-2">
            {p.preview && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={p.preview} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
            )}
            <Loader2 className="relative size-4 animate-spin text-foreground" aria-label={t("uploading")} />
          </div>
        ))}
        {kinds.length > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="grid size-20 place-items-center rounded-xl border border-dashed border-border-strong text-muted transition-colors hover:border-accent/60 hover:text-foreground"
          aria-label={t("addMedia")}
        >
          <Plus className="size-5" />
        </button>
        )}
      </div>
      <p className="text-[11px] text-muted/80">
        {kinds.length
          ? `${t("dropHint")} · ${t("accepts", { kinds: kinds.map((k) => t(`kinds.${k}`)).join(", ") })}`
          : t("noReferences")}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={kinds.map((k) => ACCEPT[k]).join(",")}
        onChange={(e) => {
          void handleFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Attachment({
  item,
  roles,
  unsupported,
  onRole,
  onRemove,
}: {
  item: MediaItem;
  roles: MediaRole[];
  unsupported: boolean;
  onRole: (role: MediaRole) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("studio");
  return (
    <div
      className={cn(
        "group relative size-20 overflow-hidden rounded-xl border bg-surface-2",
        unsupported ? "border-warning/70" : "border-border",
      )}
    >
      {item.kind === "video" ? (
        <video src={item.url} muted playsInline className="size-full object-cover" />
      ) : item.kind === "audio" ? (
        <div className="grid size-full place-items-center">
          <AudioLines className="size-5 text-muted" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote reference thumbnail
        <img src={item.url} alt={item.name ?? ""} className="size-full object-cover" />
      )}
      {item.kind === "video" && <Film className="absolute start-1.5 top-1.5 size-3 text-white/80" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("remove")}
        className={cn(
          "absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 text-white transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
          unsupported ? "opacity-100" : "opacity-100 sm:opacity-0",
        )}
      >
        <X className="size-3" />
      </button>
      {roles.length > 1 && roles.includes(item.role) ? (
        <select
          value={item.role}
          onChange={(e) => onRole(e.target.value as MediaRole)}
          aria-label={t("role")}
          className="absolute inset-x-0 bottom-0 h-5 cursor-pointer appearance-none bg-black/75 px-1 text-center text-[10px] text-white outline-none"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
      ) : (
        <span className="absolute inset-x-0 bottom-0 h-5 truncate bg-black/75 px-1 text-center text-[10px] leading-5 text-white">
          {t(`roles.${item.role}`)}
        </span>
      )}
    </div>
  );
}
