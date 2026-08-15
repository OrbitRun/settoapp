import { useEffect, useState } from "react";
import { Check, Copy, QrCode as QrIcon, Share2 } from "lucide-react";
import { toast } from "sonner";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { QrCode } from "@/components/pari/QrCode";
import { usePari } from "@/data/store";
import { ensureGroupInvitation, invitationUrl, type GroupInvitation } from "@/data/invitations";
import { useT } from "@/lib/i18n";

/** One invitation, four ways to share it: link, QR, copy and join code. */
export function InviteSheet({
  open,
  onClose,
  groupId,
  groupName,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}) {
  const pari = usePari();
  const t = useT();
  const [invitation, setInvitation] = useState<GroupInvitation | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const userId = pari.session?.user?.id ?? null;

  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    void ensureGroupInvitation(groupId, userId).then((result) => {
      if (active) setInvitation(result);
    });
    return () => {
      active = false;
    };
  }, [open, groupId, userId]);

  const url = invitation ? invitationUrl(invitation.token) : "";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    toast.success(t("invite.copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!url) return;
    const text = t("invite.shareText", { group: groupName });
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: groupName, text, url });
        return;
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    await copy();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t("invite.title")} description={groupName}>
      {!invitation ? (
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
