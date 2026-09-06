import { describe, expect, it } from "vitest";

import { invitationFate, residualOwnerReference } from "@/lib/invitation-cleanup";

const ME = "me";
const OWNER_B = "owner-b";
const SUCCESSOR = "successor";

const active = { status: "active", revoked: false, expired: false };

describe("invitations when an account is deleted", () => {
  it("1. deleting an ordinary member does not revoke the owner's pending invitation to someone else", () => {
    const fate = invitationFate({
      invite: { ...active, ownerUserId: OWNER_B, personId: "person-c" },
      groupFate: "untouched",
      deletingUserId: ME,
      deletingUserPeople: ["person-me"],
      successorUserId: null,
    });
    expect(fate).toEqual({ kind: "kept" });
  });

  it("2. an owned group that is transferred keeps its usable invitations under the new owner", () => {
    const fate = invitationFate({
      invite: { ...active, ownerUserId: ME, personId: "person-c" },
      groupFate: "transferred",
      deletingUserId: ME,
      deletingUserPeople: ["person-me"],
      successorUserId: SUCCESSOR,
    });
    expect(fate).toEqual({ kind: "transferred", ownerUserId: SUCCESSOR });
    expect(residualOwnerReference(fate, ME)).toBe(SUCCESSOR);
  });

  it("2b. an invitation pointing at the departing user is revoked, not transferred", () => {
    const fate = invitationFate({
      invite: { ...active, ownerUserId: ME, personId: "person-me" },
      groupFate: "transferred",
      deletingUserId: ME,
      deletingUserPeople: ["person-me"],
      successorUserId: SUCCESSOR,
    });
    expect(fate).toEqual({ kind: "revoked" });
  });

  it("3. an owned group with no successor takes its invitations with it", () => {
    const fate = invitationFate({
      invite: { ...active, ownerUserId: ME, personId: null },
      groupFate: "deleted",
      deletingUserId: ME,
      deletingUserPeople: ["person-me"],
      successorUserId: null,
    });
    expect(fate).toEqual({ kind: "cascade-deleted" });
    expect(residualOwnerReference(fate, ME)).toBeNull();
  });

  it("3b. invitations this account created in somebody else's group are revoked", () => {
    const fate = invitationFate({
      invite: { ...active, ownerUserId: ME, personId: "person-c" },
      groupFate: "untouched",
      deletingUserId: ME,
      deletingUserPeople: ["person-me"],
      successorUserId: null,
    });
    expect(fate).toEqual({ kind: "revoked" });
  });

  it("4. no invitation keeps a reference to the deleted account", () => {
    const rows = [
      { ownerUserId: ME, personId: null, groupFate: "deleted" as const },
      { ownerUserId: ME, personId: "person-c", groupFate: "transferred" as const },
      { ownerUserId: ME, personId: "person-c", groupFate: "untouched" as const },
      { ownerUserId: OWNER_B, personId: "person-me", groupFate: "untouched" as const },
    ];
    for (const row of rows) {
      const fate = invitationFate({
        invite: { ...active, ownerUserId: row.ownerUserId, personId: row.personId },
        groupFate: row.groupFate,
        deletingUserId: ME,
        deletingUserPeople: ["person-me"],
        successorUserId: SUCCESSOR,
      });
      // After the sweep every row owned by the deleted account is set to NULL.
      const remaining = residualOwnerReference(
        fate,
        row.ownerUserId === ME ? null : row.ownerUserId,
      );
      expect(remaining).not.toBe(ME);
    }
  });
});
