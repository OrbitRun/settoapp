import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { BottomNav, Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { Avatar } from "@/components/pari/Avatar";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { MoneyAmount, balanceTone } from "@/components/pari/MoneyAmount";
import { usePari } from "@/data/store";
import { useT, type Language } from "@/lib/i18n";
import type { Appearance } from "@/data/types";
import { cn } from "@/lib/utils";
import { AuthGate } from "@/components/pari/AuthGate";
import { clearPendingInvite } from "@/data/invitations";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — PARI" },
      { name: "description", content: "Your details, people and preferences in PARI." },
      { property: "og:title", content: "Your profile — PARI" },
      { property: "og:description", content: "Your details, people and preferences in PARI." },
    ],
  }),
  component: () => (
    <AuthGate>
      <ProfileScreen />
    </AuthGate>
  ),
});

const CURRENCIES = ["DKK", "EUR", "SEK", "NOK", "GBP", "USD"] as const;

function ProfileScreen() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sheet, setSheet] = useState<
    null | "name" | "language" | "currency" | "appearance" | "delete"
  >(null);
  const [nameValue, setNameValue] = useState(pari.currentProfileName);
  const [confirmWord, setConfirmWord] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const close = () => {
    if (deleting) return;
    setSheet(null);
  };

  const confirmPhrase = t("profile.deleteAccountConfirmWord");

  const runDelete = async () => {
    if (deleting || confirmWord.trim().toUpperCase() !== confirmPhrase) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteMyAccount();
      if (!result.success) {
        setDeleteError(t("profile.deleteAccountError"));
        return;
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      clearPendingInvite();
      try {
        await pari.signOut();
      } catch {
        // The session is already invalid after the account was deleted.
      }
      navigate({ to: "/", replace: true });
    } catch {
      setDeleteError(t("profile.deleteAccountError"));
    } finally {
      setDeleting(false);
    }
  };

  const saveName = async () => {
    await pari.updateProfile({ display_name: nameValue.trim() || pari.currentProfileName });
    close();
    toast.success(t("common.save"));
  };

  const setLanguage = async (language: Language) => {
    await pari.updateProfile({ language });
    close();
  };

  const setCurrency = async (currency: string) => {
    await pari.updateProfile({ currency });
    close();
  };

  const setAppearance = async (appearance: Appearance) => {
    await pari.updateProfile({ appearance });
    close();
  };

  const appearanceLabel: Record<Appearance, string> = {
    system: t("profile.system"),
    light: t("profile.light"),
    dark: t("profile.dark"),
  };

  const rows = [
    { key: "name" as const, label: t("profile.name"), value: pari.currentProfileName },
    {
      key: "language" as const,
      label: t("profile.language"),
      value: pari.language === "da" ? "Dansk" : "English",
    },
    { key: "currency" as const, label: t("profile.currency"), value: pari.currency },
    {
      key: "appearance" as const,
      label: t("profile.appearance"),
      value: appearanceLabel[pari.appearance],
    },
  ];

  return (
    <>
      <Screen>
        <FlowHeader title={t("profile.title")} />

        <div className="flex items-center gap-4 px-1 pb-8">
          <Avatar name={pari.currentProfileName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[22px] font-semibold tracking-[-0.03em]">
              {pari.currentProfileName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pari.session?.user?.email ?? pari.currency}
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <Panel title={t("profile.overall")}>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-[15px]">
                {pari.netBalance >= 0 ? t("profile.youAreOwed") : t("profile.youOwe")}
              </span>
              <MoneyAmount minor={Math.abs(pari.netBalance)} tone={balanceTone(pari.netBalance)} />
            </div>
          </Panel>

          <Panel title={t("profile.settings")}>
            {rows.map((row, index) => (
              <div key={row.key}>
                {index > 0 ? <Divider /> : null}
                <button
                  type="button"
                  onClick={() => {
                    setNameValue(pari.currentProfileName);
                    setSheet(row.key);
                  }}
                  className="flex w-full items-center justify-between px-4 py-4 text-left text-[15px]"
                >
                  {row.label}
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {row.value}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.6} />
                  </span>
                </button>
              </div>
            ))}
            <Divider />
            <Link
              to="/onboarding"
              className="flex items-center justify-between px-4 py-4 text-[15px]"
            >
              {t("profile.howItWorks")}
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.6} />
            </Link>
          </Panel>

          <Panel>
            <button
              type="button"
              onClick={async () => {
                await pari.signOut();
                navigate({ to: "/", replace: true });
              }}
              className="w-full px-4 py-4 text-left text-[15px] text-negative"
            >
              {t("profile.signOut")}
            </button>
            <Divider />
            <button
              type="button"
              onClick={() => {
                setConfirmWord("");
                setDeleteError(null);
                setSheet("delete");
              }}
              className="w-full px-4 py-4 text-left text-[15px] text-negative"
            >
              {t("profile.deleteAccount")}
            </button>
          </Panel>
        </div>
      </Screen>
      <BottomNav />

      <BottomSheet open={sheet !== null} onClose={close}>
        {sheet === "name" ? (
          <div className="space-y-4 px-1">
            <h2 className="text-[19px] font-semibold tracking-tight">{t("profile.name")}</h2>
            <input
              autoFocus
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              className="h-14 w-full rounded-2xl bg-surface-strong px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
            />
            <div className="space-y-2">
              <PrimaryButton onClick={saveName}>{t("common.save")}</PrimaryButton>
              <SecondaryButton onClick={close}>{t("common.cancel")}</SecondaryButton>
            </div>
          </div>
        ) : null}

        {sheet === "language" ? (
          <OptionList
            title={t("profile.language")}
            options={[
              { value: "da", label: "Dansk" },
              { value: "en", label: "English" },
            ]}
            current={pari.language}
            onSelect={(value) => setLanguage(value as Language)}
          />
        ) : null}

        {sheet === "currency" ? (
          <OptionList
            title={t("profile.currency")}
            options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            current={pari.currency}
            onSelect={setCurrency}
          />
        ) : null}

        {sheet === "appearance" ? (
          <OptionList
            title={t("profile.appearance")}
            options={[
              { value: "system", label: t("profile.system") },
              { value: "light", label: t("profile.light") },
              { value: "dark", label: t("profile.dark") },
            ]}
            current={pari.appearance}
            onSelect={(value) => setAppearance(value as Appearance)}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}

function OptionList({
  title,
  options,
  current,
  onSelect,
}: {
  title: string;
  options: { value: string; label: string }[];
  current: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-4 px-1">
      <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface-strong">
        {options.map((option, index) => (
          <div key={option.value}>
            {index > 0 ? <div className="mx-4 h-px bg-border/60" /> : null}
            <button
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-4 text-left text-[15px]",
                current === option.value && "font-medium",
              )}
            >
              {option.label}
              {current === option.value ? <span className="text-accent-foreground">✓</span> : null}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
