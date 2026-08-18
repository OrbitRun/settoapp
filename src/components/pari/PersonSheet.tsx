import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/pari/Avatar";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { MoneyAmount, balanceTone } from "@/components/pari/MoneyAmount";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";

export type PersonSheetState = {
  id: string;
  name: string;
  balanceMinor: number;
  /** Linked to a real account. */
  linked: boolean;
  /** An invitation was actually sent and is still waiting. */
  pending: boolean;
  /** No longer an active member of the group. */
  former: boolean;
  isSelf: boolean;
};

/**
 * Person detail for a group member. Presentation only — every action calls the
 * existing store/invite logic unchanged.
 */
export function PersonSheet({
  person,
  onClose,
  onInvite,
  onRemove,
}: {
  person: PersonSheetState | null;
  onClose: () => void;
  /** Opens the existing invitation sheet for this exact person. */
  onInvite: (person: PersonSheetState) => void;
  /** Opens the existing removal confirmation for this exact person. */
  onRemove: (person: PersonSheetState) => void;
}) {
  const pari = usePari();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditing(false);
    setName(person?.name ?? "");
  }, [person]);

  if (!person) return null;

  const status = person.former
    ? t("groups.formerMember")
    : person.linked
      ? t("invite.person.linked")
      : person.pending
        ? t("invite.person.pending")
        : t("invite.person.unlinked");

  const canInvite = !person.former && !person.linked;
  const canRename = !person.former;
  const canRemove = !person.former && !person.isSelf;

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await pari.renamePerson(person.id, trimmed);
      toast.success(t("person.nameSaved"));
      setEditing(false);
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose}>
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={person.name} size="md" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight">{person.name}</p>
          {person.isSelf ? (
            <p className="text-xs text-muted-foreground">{t("common.you")}</p>
          ) : null}
        </div>
      </div>

      <div className="mb-6 space-y-3 rounded-2xl bg-surface-strong px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t("person.status")}</span>
          <span className="text-sm">{status}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t("person.balance")}</span>
          <MoneyAmount
            minor={person.balanceMinor}
            tone={balanceTone(person.balanceMinor)}
            showSign={person.balanceMinor !== 0}
          />
        </div>
      </div>

      {editing ? (
        <div className="space-y-2 pb-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveName();
              }
            }}
            placeholder={t("person.namePlaceholder")}
            className="w-full rounded-2xl bg-surface-strong px-5 py-4 text-[17px] tracking-tight outline-none"
          />
          <PrimaryButton onClick={() => void saveName()} disabled={busy}>
            {t("common.save")}
          </PrimaryButton>
          <SecondaryButton onClick={() => setEditing(false)}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : (
        <div className="space-y-2 pb-2">
          {canInvite ? (
            <PrimaryButton onClick={() => onInvite(person)}>
              {person.pending ? t("invite.person.resend") : t("invite.person.invite")}
            </PrimaryButton>
          ) : null}
          {canRename ? (
            <SecondaryButton onClick={() => setEditing(true)}>
              {t("person.editName")}
            </SecondaryButton>
          ) : null}
          {canRemove ? (
            <SecondaryButton
              onClick={() => onRemove(person)}
              className="text-negative hover:bg-surface-strong/70"
            >
              {t("groups.removeMember")}
            </SecondaryButton>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}
