import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { Screen } from "@/components/pari/AppShell";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { EmptyState } from "@/components/pari/EmptyState";
import {
  acceptInvitation,
  fetchInvitationPreview,
  savePendingInvite,
  clearPendingInvite,
  type InvitationPreview,
} from "@/data/invitations";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";

/**
 * The public invitation landing page — and the future Universal Link target.
 * The token never leaks a group id, and it survives signup/login so the join
 * completes by itself afterwards.
 */
export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "You're invited — PARI" },
      { name: "description", content: "Join a group in PARI and split shared expenses." },
      { property: "og:title", content: "You're invited — PARI" },
      {
        property: "og:description",
        content: "Join a group in PARI and split shared expenses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InviteScreen,
});

/** Placeholder until the native app ships — the link stays the same. */
const APP_STORE_URL = "https://apps.apple.com/app/pari";

function InviteScreen() {
  const { token } = Route.useParams();
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchInvitationPreview(token).then((result) => {
      if (!active) return;
      setPreview(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  const join = async () => {
    if (pari.isGuest) {
      savePendingInvite(token);
      navigate({ to: "/auth", search: { mode: "signup" } });
      return;
    }
    setJoining(true);
    const groupId = await acceptInvitation(token);
    setJoining(false);
    if (!groupId) {
      toast.error(t("invite.joinFailed"));
      return;
    }
    clearPendingInvite();
    await pari.refresh();
    toast.success(t("invite.joined"));
    navigate({ to: "/groups/$groupId", params: { groupId } });
  };

  if (loading) {
    return (
      <Screen>
        <div className="mt-24 h-40 animate-pulse rounded-3xl bg-surface-strong" />
      </Screen>
    );
  }

  if (!preview) {
    return (
      <Screen>
        <div className="mt-24">
          <EmptyState title={t("invite.invalidTitle")} description={t("invite.invalidBody")} />
          <div className="mt-6">
            <SecondaryButton onClick={() => navigate({ to: "/" })}>
              {t("split.goHome")}
            </SecondaryButton>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="animate-rise mt-20 text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-strong">
          <Users className="h-7 w-7 text-primary" strokeWidth={1.8} />
        </span>
        <p className="mt-6 text-sm text-muted-foreground">
          {t("invite.invitedBy", { name: preview.inviterName })}
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.03em]">{preview.groupName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("common.memberCount", { count: preview.memberCount })}
        </p>
      </div>

      <div className="mt-10 space-y-2">
        <PrimaryButton onClick={() => void join()} disabled={joining}>
          {t("invite.join")}
        </PrimaryButton>
        {pari.isGuest ? (
          <>
            <SecondaryButton
              onClick={() => {
                savePendingInvite(token);
                navigate({ to: "/auth" });
              }}
            >
              {t("welcome.secondary")}
            </SecondaryButton>
            <p className="pt-2 text-center text-xs text-muted-foreground">
              {t("invite.needAccount")}
            </p>
          </>
        ) : null}
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="block py-3 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("invite.getApp")}
        </a>
      </div>
    </Screen>
  );
}
