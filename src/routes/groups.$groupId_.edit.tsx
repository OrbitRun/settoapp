import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Archive, ArchiveRestore, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { Avatar } from "@/components/pari/Avatar";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { EmptyState } from "@/components/pari/EmptyState";
import { AuthGate } from "@/components/pari/AuthGate";
import {
  SplitRuleEditor,
  isRuleComplete,
  seedRule,
  type SplitRule,
} from "@/components/pari/SplitRuleEditor";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SplitMode } from "@/lib/split";

export const Route = createFileRoute("/groups/$groupId_/edit")({
  head: () => ({
    meta: [
      { title: "Edit group — Setto" },
      { name: "description", content: "Rename the group, manage members and split rules." },
      { property: "og:title", content: "Edit group — Setto" },
      {
        property: "og:description",
        content: "Rename the group, manage members and split rules.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <EditGroupScreen />
    </AuthGate>
  ),
});

// Group defaults survive across expenses, so only rules that are independent
// of a total are offered here. Exact amounts stay per expense.
const OPTIONS: { value: SplitMode; labelKey: string }[] = [
  { value: "equal", labelKey: "split.equal" },
  { value: "percentage", labelKey: "split.percentage" },
  { value: "shares", labelKey: "split.shares" },
];

function EditGroupScreen() {
  const { groupId } = Route.useParams();
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();

  const group = pari.data.groups.find((g) => g.id === groupId);
  const [name, setName] = useState(group?.name ?? "");
  const saved = pari.groupRule(groupId);
  const [rule, setRule] = useState<SplitRule>({
    mode: (group?.default_split_type as SplitMode) ?? "equal",
    percentages: saved?.percentages ?? {},
    shares: saved?.shares ?? {},
    exact: {},
  });
  const split = rule.mode;
  const [newMember, setNewMember] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!group) {
    return (
      <Screen>
        <FlowHeader title={t("groups.title")} />
        <EmptyState title={t("groups.gone")} />
      </Screen>
    );
  }

  const memberIds = pari.groupPersonIds(groupId);
  const removedIds = pari.groupRemovedPersonIds(groupId);
  const candidates = pari.data.people.filter(
    (person) => !memberIds.includes(person.id) && !removedIds.includes(person.id),
  );
  const ruleMembers = memberIds.map((id) => ({ id, name: pari.personName(id) }));
  const ruleReady = rule.mode === "equal" || isRuleComplete(rule, ruleMembers, 0);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await pari.updateGroup(groupId, {
        name,
        defaultSplitType: split,
        percentages: split === "percentage" ? rule.percentages : null,
        shares: split === "shares" ? rule.shares : null,
      });
      toast.success(t("groups.saved"));
      navigate({ to: "/groups/$groupId", params: { groupId } });
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const addNamedMember = async () => {
    const trimmed = newMember.trim();
    if (!trimmed) return;
    const person = await pari.addPerson(trimmed);
    setNewMember("");
    if (person) await pari.addGroupMembers(groupId, [person.id]);
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    const { id, name: personName } = pendingRemove;
    setPendingRemove(null);
    const result = await pari.removeGroupMember(groupId, id);
    if (result === "owner-self") toast.error(t("groups.cannotRemoveSelf"));
    else if (result === "not-allowed") toast.error(t("groups.removeNotAllowed"));
    else if (result === "deactivated")
      toast.success(t("groups.memberDeactivated", { name: personName }));
    else toast.success(t("groups.memberRemoved", { name: personName }));
  };

  const restore = async (personId: string) => {
    await pari.addGroupMembers(groupId, [personId]);
    toast.success(t("groups.memberRestored", { name: pari.personName(personId) }));
  };

  const toggleArchive = async () => {
    const archived = Boolean(group.archived_at);
    await pari.setGroupArchived(groupId, !archived);
    toast.success(archived ? t("groups.unarchived") : t("groups.archived"));
    navigate({ to: "/groups" });
  };

  const remove_group = async () => {
    setConfirmDelete(false);
    await pari.deleteGroup(groupId);
    toast.success(t("groups.deleted"));
    navigate({ to: "/groups" });
  };

  return (
    <>
      <Screen>
        <FlowHeader title={t("groups.edit")} subtitle={group.name} />

        <div className="space-y-9">
          <section className="space-y-3">
            <label htmlFor="group-name" className="block px-1 text-[13px] text-muted-foreground">
              {t("common.groupName")}
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl bg-surface px-5 py-4 text-[17px] tracking-tight shadow-soft outline-none"
            />
          </section>

          <section className="space-y-3">
            <p className="px-1 text-[13px] text-muted-foreground">{t("groups.people")}</p>
            <Panel>
              {memberIds.map((personId, index) => (
                <div key={personId}>
                  {index > 0 ? <Divider /> : null}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={pari.personName(personId)} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {pari.personName(personId)}
                      {personId === pari.currentPersonId ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t("common.you")}
                        </span>
                      ) : null}
                    </span>
                    {personId !== pari.currentPersonId ? (
                      <button
                        type="button"
                        aria-label={`${t("common.remove")} ${pari.personName(personId)}`}
                        onClick={() =>
                          setPendingRemove({ id: personId, name: pari.personName(personId) })
                        }
                        className="text-muted-foreground/70 transition-colors hover:text-negative"
                      >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              <Divider />
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong">
                  <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                </span>
                <input
                  value={newMember}
                  onChange={(event) => setNewMember(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addNamedMember();
                    }
                  }}
                  placeholder={t("groups.addPersonPlaceholder")}
                  className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted-foreground/70"
                />
              </div>
            </Panel>

            {removedIds.length > 0 ? (
              <div className="space-y-2">
                <p className="px-1 text-[13px] text-muted-foreground">
                  {t("groups.formerMembers")}
                </p>
                <Panel>
                  {removedIds.map((personId, index) => (
                    <div key={personId}>
                      {index > 0 ? <Divider /> : null}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={pari.personName(personId)} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">
                          {pari.personName(personId)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void restore(personId)}
                          className="shrink-0 rounded-xl bg-surface-strong px-3 py-2 text-xs font-medium"
                        >
                          {t("groups.restoreMember")}
                        </button>
                      </div>
                    </div>
                  ))}
                </Panel>
              </div>
            ) : null}

            {candidates.length > 0 ? (
              <div className="flex flex-wrap gap-2 px-1">
                {candidates.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => void pari.addGroupMembers(groupId, [person.id])}
                    className="rounded-full bg-surface-strong px-3.5 py-1.5 text-sm"
                  >
                    + {person.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <p className="px-1 text-[13px] text-muted-foreground">{t("groups.defaultSplit")}</p>
            <div className="flex gap-2">
              {OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRule((prev) => seedRule(prev, ruleMembers, option.value))}
                  className={cn(
                    "flex-1 rounded-2xl py-3 text-sm font-medium transition-colors",
                    split === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-strong text-muted-foreground",
                  )}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>

            {rule.mode !== "equal" ? (
              <div className="rounded-3xl bg-surface p-5 shadow-soft">
                <SplitRuleEditor
                  rule={rule}
                  people={ruleMembers}
                  totalMinor={0}
                  showAmounts={false}
                  onChange={(patch) => setRule((prev) => ({ ...prev, ...patch }))}
                />
              </div>
            ) : null}
          </section>

          <PrimaryButton onClick={() => void save()} disabled={!name.trim() || !ruleReady || busy}>
            {t("common.save")}
          </PrimaryButton>

          <Panel>
            <button
              type="button"
              onClick={() => void toggleArchive()}
              className="flex w-full items-center gap-3 px-4 py-4 text-left text-[15px]"
            >
              {group.archived_at ? (
                <ArchiveRestore className="h-4 w-4" strokeWidth={1.8} />
              ) : (
                <Archive className="h-4 w-4" strokeWidth={1.8} />
              )}
              {group.archived_at ? t("groups.unarchive") : t("groups.archive")}
            </button>
            <Divider />
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left text-[15px] text-negative"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              {t("groups.delete")}
            </button>
          </Panel>
        </div>
      </Screen>

      <BottomSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("groups.deleteTitle")}
        description={t("groups.deleteBody", { group: group.name })}
      >
        <div className="space-y-2 pb-2">
          <PrimaryButton onClick={() => void remove_group()}>
            {t("groups.deleteConfirm")}
          </PrimaryButton>
          <SecondaryButton onClick={() => setConfirmDelete(false)}>
            {t("common.cancel")}
          </SecondaryButton>
        </div>
      </BottomSheet>

      <BottomSheet
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title={t("groups.removeMemberTitle", { name: pendingRemove?.name ?? "" })}
        description={
          pendingRemove && pari.personHasGroupHistory(groupId, pendingRemove.id)
            ? `${t("groups.removeHistoryBody", { name: pendingRemove.name })} ${t("groups.removeOutstanding")}`
            : t("groups.removeEmptyBody", { name: pendingRemove?.name ?? "" })
        }
      >
        <div className="space-y-2 pb-2">
          <PrimaryButton onClick={() => void confirmRemove()}>
            {t("groups.removeMember")}
          </PrimaryButton>
          <SecondaryButton onClick={() => setPendingRemove(null)}>
            {t("common.cancel")}
          </SecondaryButton>
        </div>
      </BottomSheet>
    </>
  );
}
