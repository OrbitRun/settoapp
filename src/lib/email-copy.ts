/**
 * User-visible wording for outgoing email, kept apart from auth logic so a
 * later pass can add sender domain, templates and branding without touching
 * any authentication behaviour.
 *
 * Privacy rule for invitation email: inviter name and group name only. Never
 * balances, expenses, receipts, settlements or other members' amounts.
 */

import type { Language } from "@/lib/i18n";

export type EmailKind = "verify" | "reset" | "invitation" | "email_change";

export type EmailCopy = {
  subject: string;
  heading: string;
  body: string;
  action: string;
  footer: string;
};

type Vars = { group?: string; inviter?: string; app?: string };

const APP = "PARI";

const da = (kind: EmailKind, v: Vars): EmailCopy => {
  const app = v.app ?? APP;
  switch (kind) {
    case "verify":
      return {
        subject: `Bekræft din ${app}-konto`,
        heading: "Bekræft din e-mail",
        body: "Tryk på knappen for at bekræfte din e-mailadresse og komme i gang.",
        action: "Bekræft e-mail",
        footer: "Hvis du ikke har oprettet en konto, kan du roligt ignorere denne mail.",
      };
    case "reset":
      return {
        subject: `Nulstil din ${app}-adgangskode`,
        heading: "Vælg en ny adgangskode",
        body: "Tryk på knappen for at vælge en ny adgangskode. Linket udløber snart.",
        action: "Nulstil adgangskode",
        footer: "Hvis du ikke bad om dette, sker der ingenting — ignorer blot mailen.",
      };
    case "invitation":
      return {
        subject: `${v.inviter ?? "En ven"} har inviteret dig til ${v.group ?? "en gruppe"}`,
        heading: `Du er inviteret til ${v.group ?? "en gruppe"}`,
        body: `${v.inviter ?? "En ven"} vil dele udgifter med dig i ${app}.`,
        action: "Se invitationen",
        footer: "Invitationslinket virker i en begrænset periode.",
      };
    case "email_change":
      return {
        subject: `Bekræft din nye e-mail i ${app}`,
        heading: "Bekræft din nye e-mail",
        body: "Tryk på knappen for at bekræfte ændringen af din e-mailadresse.",
        action: "Bekræft ændring",
        footer: "Hvis du ikke bad om dette, så skift din adgangskode.",
      };
  }
};

const en = (kind: EmailKind, v: Vars): EmailCopy => {
  const app = v.app ?? APP;
  switch (kind) {
    case "verify":
      return {
        subject: `Confirm your ${app} account`,
        heading: "Confirm your email",
        body: "Tap the button to confirm your email address and get started.",
        action: "Confirm email",
        footer: "If you didn't create an account, you can safely ignore this email.",
      };
    case "reset":
      return {
        subject: `Reset your ${app} password`,
        heading: "Choose a new password",
        body: "Tap the button to choose a new password. The link expires soon.",
        action: "Reset password",
        footer: "If you didn't ask for this, nothing happens — just ignore this email.",
      };
    case "invitation":
      return {
        subject: `${v.inviter ?? "A friend"} invited you to ${v.group ?? "a group"}`,
        heading: `You're invited to ${v.group ?? "a group"}`,
        body: `${v.inviter ?? "A friend"} wants to split expenses with you in ${app}.`,
        action: "View invitation",
        footer: "The invitation link works for a limited time.",
      };
    case "email_change":
      return {
        subject: `Confirm your new email in ${app}`,
        heading: "Confirm your new email",
        body: "Tap the button to confirm the change of your email address.",
        action: "Confirm change",
        footer: "If you didn't ask for this, change your password.",
      };
  }
};

export function emailCopy(kind: EmailKind, language: Language, vars: Vars = {}): EmailCopy {
  return language === "en" ? en(kind, vars) : da(kind, vars);
}
