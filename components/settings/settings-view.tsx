"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, LogOut, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { MODELS } from "@/generation/catalog";
import type { Surface } from "@/generation/catalog/types";
import { FEATURES } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/env";
import {
  addMember,
  listMembers,
  removeMember,
  saveTeamSettings,
  switchTeam,
  updateMember,
  updateTeam,
  type Member,
} from "@/lib/team/actions";
import type { ModelCosts } from "@/lib/team/cost";
import type { TeamContext, TeamRole } from "@/lib/team/types";
import { TEAM_QUERY, useTeam } from "@/lib/team/use-team";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { RequiresSupabase } from "@/components/common/requires-supabase";
import { ModelIcon } from "@/components/studio/model-icon";

export function SettingsView() {
  const { data: team, isLoading } = useTeam();
  if (!isSupabaseConfigured) return <RequiresSupabase />;
  if (isLoading || !team) return <div className="shimmer h-96 rounded-2xl" />;
  return (
    <div className="space-y-6">
      <TeamSection team={team} />
      <MembersSection team={team} />
      <ModelsSection team={team} />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function useRefreshTeam() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    await queryClient.invalidateQueries();
    router.refresh();
  };
}

/* ─── Team ─────────────────────────────────────────────────────────────── */

function TeamSection({ team }: { team: TeamContext }) {
  const t = useTranslations("settings");
  const refresh = useRefreshTeam();
  const [name, setName] = useState(team.team.name);
  const [budget, setBudget] = useState(team.team.monthlyBudget?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(team.team.name);
    setBudget(team.team.monthlyBudget?.toString() ?? "");
  }, [team.team.id, team.team.name, team.team.monthlyBudget]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateTeam({ name, monthlyBudget: budget.trim() === "" ? null : Number(budget) });
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(t("saved"));
    await refresh();
  };

  return (
    <Section title={t("team")} description={t("teamHint")}>
      {team.teams.length > 1 && (
        <div className="mb-4 max-w-sm space-y-1.5">
          <Label htmlFor="team-switch">{t("activeTeam")}</Label>
          <NativeSelect
            id="team-switch"
            value={team.team.id}
            onChange={async (e) => {
              const result = await switchTeam(e.target.value);
              if (!result.ok) return toast.error(result.error);
              await refresh();
            }}
          >
            {team.teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {t(`roles.${x.role}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="team-name">{t("teamName")}</Label>
          <Input id="team-name" dir="auto" value={name} maxLength={80} disabled={!team.isAdmin} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-budget">{t("monthlyBudget")}</Label>
          <Input
            id="team-budget"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            dir="ltr"
            placeholder={t("unlimited")}
            value={budget}
            disabled={!team.isAdmin}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        {team.isAdmin && (
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {t("save")}
          </Button>
        )}
      </form>
    </Section>
  );
}

/* ─── Members ──────────────────────────────────────────────────────────── */

function MembersSection({ team }: { team: TeamContext }) {
  const t = useTranslations("settings");
  const refresh = useRefreshTeam();
  const queryClient = useQueryClient();
  const { data: members, isLoading } = useQuery({
    queryKey: ["members", team.team.id],
    queryFn: async () => {
      const result = await listMembers();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [adding, setAdding] = useState(false);
  const reload = () => queryClient.invalidateQueries({ queryKey: ["members", team.team.id] });
  const isOwner = team.team.role === "owner";

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const result = await addMember({ email, role });
    setAdding(false);
    if (!result.ok) return toast.error(result.error);
    setEmail("");
    toast.success(t("memberAdded"));
    await reload();
  };

  return (
    <Section title={t("members")} description={t("membersHint")}>
      {isLoading ? (
        <div className="shimmer h-24 rounded-xl" />
      ) : (
        <div className="space-y-2" data-testid="members">
          {(members ?? []).map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              self={m.userId === team.userId}
              canEdit={team.isAdmin && (isOwner || m.role !== "owner")}
              canGrantOwner={isOwner}
              onChanged={reload}
              onLeft={refresh}
            />
          ))}
        </div>
      )}
      {team.isAdmin && (
        <form onSubmit={onAdd} className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_160px_auto]">
          <Input type="email" dir="ltr" required placeholder={t("inviteEmail")} aria-label={t("inviteEmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value as TeamRole)} aria-label={t("role")}>
            <option value="member">{t("roles.member")}</option>
            <option value="admin">{t("roles.admin")}</option>
            {isOwner && <option value="owner">{t("roles.owner")}</option>}
          </NativeSelect>
          <Button type="submit" disabled={adding}>
            {adding ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {t("add")}
          </Button>
          <p className="text-[11px] text-muted sm:col-span-3">{t("inviteHint")}</p>
        </form>
      )}
    </Section>
  );
}

function MemberRow({
  member,
  self,
  canEdit,
  canGrantOwner,
  onChanged,
  onLeft,
}: {
  member: Member;
  self: boolean;
  canEdit: boolean;
  canGrantOwner: boolean;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const t = useTranslations("settings");
  const [role, setRole] = useState<TeamRole>(member.role);
  const [cap, setCap] = useState(member.dailyCap?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = role !== member.role || cap !== (member.dailyCap?.toString() ?? "");

  const save = async () => {
    setBusy(true);
    const result = await updateMember({ userId: member.userId, role, dailyCap: cap.trim() === "" ? null : Number(cap) });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(t("saved"));
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm(self ? t("confirmLeave") : t("confirmRemove", { email: member.email }))) return;
    const result = await removeMember({ userId: member.userId });
    if (!result.ok) return toast.error(result.error);
    if (self) onLeft();
    else onChanged();
  };

  return (
    <div className="grid items-center gap-2 rounded-xl border border-border bg-surface-2/40 p-3 sm:grid-cols-[1fr_140px_140px_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm" dir="ltr">
          {member.email}
        </p>
        <p className="text-[11px] text-muted">
          {member.fullName ? `${member.fullName} · ` : ""}
          {self && <Badge variant="accent">{t("you")}</Badge>}
        </p>
      </div>
      {canEdit ? (
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as TeamRole)} aria-label={t("role")}>
          <option value="member">{t("roles.member")}</option>
          <option value="admin">{t("roles.admin")}</option>
          {(canGrantOwner || member.role === "owner") && <option value="owner">{t("roles.owner")}</option>}
        </NativeSelect>
      ) : (
        <span className="text-xs text-muted">{t(`roles.${member.role}`)}</span>
      )}
      {canEdit ? (
        <Input
          type="number"
          min={0}
          step="any"
          dir="ltr"
          className="h-9"
          placeholder={t("noCap")}
          aria-label={t("dailyCap")}
          value={cap}
          onChange={(e) => setCap(e.target.value)}
        />
      ) : (
        <span className="text-xs text-muted" dir="ltr">
          {member.dailyCap === null ? t("noCap") : `${member.dailyCap} / ${t("day")}`}
        </span>
      )}
      <div className="flex justify-end gap-1">
        {canEdit && dirty && (
          <Button size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            {t("save")}
          </Button>
        )}
        {(canEdit || self) && (
          <Button size="sm" variant="ghost" onClick={() => void remove()} title={self ? t("leave") : t("remove")} aria-label={self ? t("leave") : t("remove")}>
            {self ? <LogOut /> : <Trash2 />}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Models ───────────────────────────────────────────────────────────── */

type CostInput = Record<string, { perRun: string; perSecond: string }>;

function ModelsSection({ team }: { team: TeamContext }) {
  const t = useTranslations("settings");
  const refresh = useRefreshTeam();
  const queryClient = useQueryClient();
  const [disabled, setDisabled] = useState<string[]>(team.settings.disabledModels);
  const [defaults, setDefaults] = useState(team.settings.defaultModels);
  const [markup, setMarkup] = useState(String(team.settings.markupPercent));
  const [costs, setCosts] = useState<CostInput>(() => toInput(team.settings.modelCosts));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisabled(team.settings.disabledModels);
    setDefaults(team.settings.defaultModels);
    setCosts(toInput(team.settings.modelCosts));
    setMarkup(String(team.settings.markupPercent));
  }, [team.settings]);

  const onSave = async () => {
    setSaving(true);
    const result = await saveTeamSettings({
      disabledModels: disabled,
      defaultModels: defaults,
      modelCosts: Object.fromEntries(Object.entries(costs).map(([id, c]) => [id, { perRun: c.perRun, perSecond: c.perSecond }])),
      markupPercent: Number(markup) || 0,
    });
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    await queryClient.invalidateQueries({ queryKey: TEAM_QUERY });
    toast.success(t("saved"));
    await refresh();
  };

  return (
    <Section title={t("models")} description={team.isAdmin ? t("modelsHint") : t("modelsReadOnly")}>
      <div className="space-y-6">
        {(["image", "video"] as const).map((surface) => (
          <ModelTable
            key={surface}
            surface={surface}
            editable={team.isAdmin}
            disabled={disabled}
            defaultId={defaults[surface]}
            costs={costs}
            onToggle={(id, on) => setDisabled((d) => (on ? d.filter((x) => x !== id) : [...d, id]))}
            onDefault={(id) => setDefaults((d) => ({ ...d, [surface]: id }))}
            onCost={(id, key, value) => setCosts((c) => ({ ...c, [id]: { perRun: c[id]?.perRun ?? "", perSecond: c[id]?.perSecond ?? "", [key]: value } }))}
          />
        ))}

        {FEATURES.resellerMarkup && (
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="markup">{t("markup")}</Label>
            <Input id="markup" type="number" min={0} max={1000} dir="ltr" disabled={!team.isAdmin} value={markup} onChange={(e) => setMarkup(e.target.value)} />
          </div>
        )}

        {team.isAdmin && (
          <div className="flex justify-end">
            <Button onClick={() => void onSave()} disabled={saving} data-testid="save-models">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {t("saveModels")}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function ModelTable({
  surface,
  editable,
  disabled,
  defaultId,
  costs,
  onToggle,
  onDefault,
  onCost,
}: {
  surface: Surface;
  editable: boolean;
  disabled: string[];
  defaultId: string | undefined;
  costs: CostInput;
  onToggle: (id: string, on: boolean) => void;
  onDefault: (id: string) => void;
  onCost: (id: string, key: "perRun" | "perSecond", value: string) => void;
}) {
  const t = useTranslations("settings");
  const models = useMemo(() => MODELS.filter((m) => m.surface === surface), [surface]);
  const firstEnabled = models.find((m) => !disabled.includes(m.id))?.id;
  const effectiveDefault = defaultId && !disabled.includes(defaultId) ? defaultId : firstEnabled;

  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        {surface === "image" ? t("imageModels") : t("videoModels")} · {models.length - disabled.filter((id) => models.some((m) => m.id === id)).length}/{models.length}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-surface-2/60 text-muted">
            <tr>
              <th className="p-2.5 text-start font-normal">{t("model")}</th>
              <th className="p-2.5 font-normal">{t("enabled")}</th>
              <th className="p-2.5 font-normal">{t("default")}</th>
              <th className="p-2.5 font-normal">{t("perRun")}</th>
              {surface === "video" && <th className="p-2.5 font-normal">{t("perSecond")}</th>}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const on = !disabled.includes(m.id);
              return (
                <tr key={m.id} className={cn("border-t border-border", !on && "opacity-50")} data-testid={`model-row-${m.id}`}>
                  <td className="p-2.5">
                    <span className="flex items-center gap-2" dir="ltr">
                      <ModelIcon model={m} className="size-6" />
                      {m.label}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="inline-flex">
                      <Switch checked={on} onCheckedChange={(v) => editable && onToggle(m.id, v)} aria-label={`${t("enabled")} ${m.label}`} />
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="radio"
                      name={`default-${surface}`}
                      checked={effectiveDefault === m.id}
                      disabled={!editable || !on}
                      onChange={() => onDefault(m.id)}
                      aria-label={`${t("default")} ${m.label}`}
                      className="accent-[var(--accent-from)]"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      dir="ltr"
                      disabled={!editable}
                      value={costs[m.id]?.perRun ?? ""}
                      placeholder="—"
                      onChange={(e) => onCost(m.id, "perRun", e.target.value)}
                      aria-label={`${t("perRun")} ${m.label}`}
                      className="h-8 w-24"
                    />
                  </td>
                  {surface === "video" && (
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        dir="ltr"
                        disabled={!editable}
                        value={costs[m.id]?.perSecond ?? ""}
                        placeholder="—"
                        onChange={(e) => onCost(m.id, "perSecond", e.target.value)}
                        aria-label={`${t("perSecond")} ${m.label}`}
                        className="h-8 w-24"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toInput(costs: ModelCosts): CostInput {
  return Object.fromEntries(
    Object.entries(costs).map(([id, c]) => [id, { perRun: c.perRun?.toString() ?? "", perSecond: c.perSecond?.toString() ?? "" }]),
  );
}
