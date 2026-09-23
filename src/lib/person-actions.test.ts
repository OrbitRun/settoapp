import { describe, expect, it } from "vitest";

import { personInviteAction, personInviteLabelKey } from "@/lib/person-actions";
import { da, en } from "@/lib/i18n";

const base = {
  linked: false,
  pending: false,
  former: false,
  isSelf: false,
};

describe("person invite eligibility", () => {
  it("offers a plain invitation for a fresh, unlinked, active person", () => {
    expect(personInviteAction(base)).toBe("invite");
    expect(personInviteLabelKey("invite")).toBe("invite.person.invite");
  });

  it("offers a resend when an invitation is already waiting", () => {
    expect(personInviteAction({ ...base, pending: true })).toBe("resend");
    expect(personInviteLabelKey("resend")).toBe("invite.person.resend");
  });

  it("offers 'invite again' for a former, unlinked member", () => {
    expect(personInviteAction({ ...base, former: true })).toBe("invite-again");
    expect(personInviteLabelKey("invite-again")).toBe("invite.person.inviteAgain");
  });

  it("keeps 'invite again' when a former member already has a pending invitation", () => {
    expect(personInviteAction({ ...base, former: true, pending: true })).toBe("invite-again");
  });

  it("never invites an active person that is already linked to an account", () => {
    expect(personInviteAction({ ...base, linked: true })).toBeNull();
  });

  it("offers 'invite again' for a former member who already has an account", () => {
    expect(personInviteAction({ ...base, linked: true, former: true })).toBe("invite-again");
    expect(personInviteAction({ ...base, linked: true, former: true, pending: true })).toBe(
      "invite-again",
    );
  });

  it("never invites yourself", () => {
    expect(personInviteAction({ ...base, isSelf: true })).toBeNull();
  });

  it("has Danish and English copy for every label", () => {
    for (const key of [
      "invite.person.invite",
      "invite.person.resend",
      "invite.person.inviteAgain",
    ] as const) {
      expect(en[key]).toBeTruthy();
      expect(da[key]).toBeTruthy();
    }
  });
});
