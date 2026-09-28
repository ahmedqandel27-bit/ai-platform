"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FolderKanban, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/env";
import { createProject, deleteProject, renameProject, type Project } from "@/lib/projects/actions";
import { PROJECTS_QUERY, useProjects } from "@/lib/team/use-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RequiresSupabase } from "@/components/common/requires-supabase";

export function ProjectsView() {
  const t = useTranslations("projects");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useProjects();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (!isSupabaseConfigured) return <RequiresSupabase />;

  const refresh = () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY });

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const result = await createProject({ name });
    setCreating(false);
    if (!result.ok) return toast.error(result.error);
    setName("");
    await refresh();
  };

  const onRename = async (project: Project) => {
    const result = await renameProject({ id: project.id, name: editName });
    if (!result.ok) return toast.error(result.error);
    setEditing(null);
    await refresh();
  };

  const onDelete = async (project: Project) => {
    if (!window.confirm(t("confirmDelete", { name: project.name }))) return;
    const result = await deleteProject({ id: project.id });
    if (!result.ok) return toast.error(result.error);
    await refresh();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="flex max-w-lg gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t("newPlaceholder")} aria-label={t("newPlaceholder")} />
        <Button type="submit" disabled={creating || !name.trim()}>
          {creating ? <Loader2 className="animate-spin" /> : <Plus />}
          {t("create")}
        </Button>
      </form>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-28 rounded-2xl" />
          ))}
        </div>
      ) : !projects?.length ? (
        <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-border-strong p-10 text-center">
          <div className="flex max-w-sm flex-col items-center gap-3">
            <FolderKanban className="size-6 text-accent" />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted">{t("emptyBody")}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="project-list">
          {projects.map((project) => (
            <div key={project.id} className="glass group relative rounded-2xl p-4 transition hover:border-border-strong">
              {editing === project.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void onRename(project);
                  }}
                >
                  <Input autoFocus value={editName} maxLength={80} onChange={(e) => setEditName(e.target.value)} className="h-9" />
                  <Button type="submit" size="sm">
                    {t("save")}
                  </Button>
                </form>
              ) : (
                <Link href={`/projects/${project.id}`} className="block">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-accent/15">
                      <FolderKanban className="size-5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1 pe-8">
                      <p className="truncate font-medium" dir="auto">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted">
                        {t("count", { count: project.jobs })} ·{" "}
                        {new Date(project.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </Link>
              )}
              {editing !== project.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("actions")}
                      className="absolute end-3 top-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-foreground"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(project.id);
                        setEditName(project.name);
                      }}
                    >
                      <Pencil />
                      {t("rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void onDelete(project)} className="text-danger">
                      <Trash2 />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
