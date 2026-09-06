import { describe, expect, it } from "vitest";

import { claimOutcome, reactivates, type ClaimContext } from "@/lib/claim-lifecycle";

const ACTIVE = { status: "active", revoked: false, expired: false };
const USED = { status: "used", revoked: true, expired: false };
const EXPIRED = { status: "active", revoked: false, expired: true };

const ctx = (over: Partial<ClaimContext> = {}): ClaimContext => ({
  invite: ACTIVE,
  personExists: true,
  personLinkedTo: null,
  membershipExists: true,
  membershipRemoved: false,
  callerActiveElsewhereInGroup: false,
  callerId: "me",
  ...over,
});

describe("person invitation claim lifecycle", () => {
  it("A. a valid invitation reactivates a former member", () => {
    const out = claimOutcome(ctx({ membershipRemoved: true }));
    expect(out).toBe("claimed");
    expect(reactivates(out)).toBe(true);
  });

  it("B. a used invitation for a still-active member is a harmless already_member", () => {
    const out = claimOutcome(ctx({ invite: USED, personLinkedTo: "me" }));
    expect(out).toBe("already_member");
    expect(reactivates(out)).toBe(false);
  });

  it("C. a used invitation must not reactivate a membership removed afterwards", () => {
    const out = claimOutcome(
      ctx({ invite: USED, personLinkedTo: "me", membershipRemoved: true }),
    );
    expect(out).toBe("revoked");
    expect(reactivates(out)).toBe(false);
  });

  it("D. an expired invitation must not reactivate a former member", () => {
    const mine = claimOutcome(
      ctx({ invite: EXPIRED, personLinkedTo: "me", membershipRemoved: true }),
    );
    expect(mine).toBe("expired");
    expect(reactivates(mine)).toBe(false);
    expect(reactivates(claimOutcome(ctx({ invite: EXPIRED, membershipRemoved: true })))).toBe(
      false,
    );
  });

  it("E. a person linked to another account is never taken over", () => {
    expect(claimOutcome(ctx({ personLinkedTo: "someone-else" }))).toBe("person_taken");
  });

  it("F. a missing historical membership is invalid, never reconstructed", () => {
    expect(claimOutcome(ctx({ membershipExists: false }))).toBe("invalid");
    expect(claimOutcome(ctx({ personExists: false }))).toBe("invalid");
  });

  it("requires a session", () => {
    expect(claimOutcome(ctx({ callerId: null }))).toBe("unauthenticated");
  });
});
