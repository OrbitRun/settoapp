import { useNavigate } from "@tanstack/react-router";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";

/**
 * Contextual "create an account" prompt. Shown only when a guest reaches a
 * feature that needs persistence — never as a gate on the app itself.
 */
export function AccountSheet() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();
  const reason = pari.accountPrompt;

  const go = (mode: "signup" | "signin") => {
    pari.dismissAccountPrompt();
    navigate({ to: "/auth", search: mode === "signup" ? { mode: "signup" } : {} });
  };

  return (
    <BottomSheet
      open={Boolean(reason)}
      onClose={pari.dismissAccountPrompt}
      title={reason === "save_split" ? t("account.saveTitle") : t("account.title")}
    >
      <p className="text-[15px] text-muted-foreground">{reason ? t(`account.${reason}`) : ""}</p>
      <div className="mt-6 space-y-3">
        <PrimaryButton onClick={() => go("signup")}>{t("account.cta")}</PrimaryButton>
        <SecondaryButton onClick={() => go("signin")}>{t("account.signIn")}</SecondaryButton>
        <button
          type="button"
          onClick={pari.dismissAccountPrompt}
          className="mx-auto block py-2 text-sm text-muted-foreground"
        >
          {t("account.later")}
        </button>
      </div>
    </BottomSheet>
  );
}
