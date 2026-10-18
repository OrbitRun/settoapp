import { useEffect, useState } from "react";
import { Check, Copy, QrCode as QrIcon, Share2 } from "lucide-react";
import { toast } from "sonner";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { QrCode } from "@/components/pari/QrCode";
import { usePari } from "@/data/store";
import {
  ensureGroupInvitation,
  invitationUrl,
  markInvitationSent,
  type GroupInvitation,
} from "@/data/invitations";
import { useT } from "@/lib/i18n";
import { runInvitationRequest, type InvitationRequestState } from "@/lib/invitation-request";

/** One invitation, four ways to share it: link, QR, copy and join code. */
export function InviteSheet({
  open,
  onClose,
  groupId,
  groupName,
  personId = null,
  personName = null,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  /** When set, the invitation lets the recipient claim this existing person. */
  personId?: string | null;
  personName?: string | null;
  /** Fires only when an invitation was really shared or copied. */
  onSent?: () => void;
}) {
  const pari = usePari();
  const t = useT();
  const [requestState, setRequestState] = useState<InvitationRequestState<GroupInvitation>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const invitation = requestState.status === "ready" ? requestState.invitation : null;
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const userId = pari.session?.user?.id ?? null;

  useEffect(() => {
    if (!open) {
      setRequestState({ status: "loading" });
      return;
    }
    if (!userId) {
      setRequestState({ status: "failed", reason: "temporary" });
      return;
    }
    let active = true;
    void runInvitationRequest(
      (signal) => ensureGroupInvitation(groupId, userId, personId, signal),
      (state) => { if (active) setRequestState(state); },
    );
    return () => {
      active = false;
    };
  }, [open, groupId, userId, personId, attempt]);

  const url = invitation ? invitationUrl(invitation.token) : "";


  /** Marks the invitation as sent — only ever after a completed action. */
  const confirmSent = async () => {
    if (!invitation) return;
    await markInvitationSent(invitation.id);
    onSent?.();
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      toast.error(t("invite.copyFailed"));
      return;
    }
    setCopied(true);
    toast.success(t("invite.copied"));
    setTimeout(() => setCopied(false), 2000);
    await confirmSent();
  };

  const share = async () => {
    if (!url) return;
    const text = t("invite.shareText", { group: groupName });
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: groupName, text, url });
      } catch (err) {
        // User cancellation/dismissal is not a failure; anything else falls back
        // to copying the HTTPS link so the invitation is still usable.
        const dismissed =
          err instanceof DOMException && err.name === "AbortError";
        if (dismissed) return;
        await copy();
        return;
      }
      await confirmSent();
      return;
    }
    await copy();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={personName ? t("invite.personTitle", { name: personName }) : t("invite.title")}
      description={personName ? t("invite.personDescription", { name: personName }) : groupName}
    >

      {requestState.status === "failed" ? (
        <div className="space-y-3 pb-2">
          <p className="rounded-2xl bg-surface-strong px-4 py-3.5 text-sm text-muted-foreground">
            {t(requestState.reason === "permission" ? "invite.permissionDenied" : "invite.createFailed")}
          </p>
          {requestState.reason === "temporary" ? (
            <PrimaryButton onClick={() => setAttempt((previous) => previous + 1)}>
              {t("invite.retry")}
            </PrimaryButton>
          ) : null}
          <SecondaryButton onClick={onClose}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : !invitation ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface-strong" />
      ) : (
        <div className="space-y-4 pb-2">
          {showQr ? <QrCode value={url} /> : null}

          <div className="rounded-2xl bg-surface-strong px-4 py-3">
            <p className="text-xs text-muted-foreground">{t("invite.link")}</p>
            <p className="mt-0.5 truncate text-[15px]">{url}</p>
          </div>

          <div className="rounded-2xl bg-surface-strong px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">{t("invite.code")}</p>
            <p className="mt-1 text-[26px] font-semibold tracking-[0.18em]">
              {invitation.join_code}
            </p>
          </div>

          <div className="space-y-2">
            <PrimaryButton onClick={() => void share()}>
              <span className="inline-flex items-center justify-center gap-2">
                <Share2 className="h-4 w-4" strokeWidth={2} />
                {t("invite.share")}
              </span>
            </PrimaryButton>
            <SecondaryButton onClick={() => void copy()}>
              <span className="inline-flex items-center justify-center gap-2">
                {copied ? (
                  <Check className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={2} />
                )}
                {t("invite.copy")}
              </span>
            </SecondaryButton>
            <SecondaryButton onClick={() => setShowQr((prev) => !prev)}>
              <span className="inline-flex items-center justify-center gap-2">
                <QrIcon className="h-4 w-4" strokeWidth={2} />
                {showQr ? t("invite.hideQr") : t("invite.showQr")}
              </span>
            </SecondaryButton>
          </div>

          <p className="pb-2 text-center text-xs text-muted-foreground">{t("invite.expires")}</p>
        </div>
      )}
    </BottomSheet>
  );
}
