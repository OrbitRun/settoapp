import { describe, expect, it } from "vitest";

import {
  activePersonIdsFor,
  groupPeopleRows,
  removalMode,
  removedPersonIdsFor,
  type MembershipRow,
} from "@/lib/group-people";
import { personInviteAction } from "@/lib/person-actions";

describe("People tab rows", () => {
  it("A. keeps a settled former member visible at zero", () => {
    const rows = groupPeopleRows({
      balances: [{ personId: "owner", netMinor: 0 }],
      removedPersonIds: ["zia"],
    });
    expect(rows.map((r) => r.personId)).toEqual(["owner", "zia"]);
    expect(rows[1]).toEqual({ personId: "zia", netMinor: 0, former: true });
  });

  it("keeps a former member with an open balance exactly once", () => {
    const rows = groupPeopleRows({
      balances: [
        { personId: "owner", netMinor: 2500 },
        { personId: "zia", netMinor: -2500 },
      ],
      removedPersonIds: ["zia"],
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.personId === "zia")).toEqual({
      personId: "zia",
      netMinor: -2500,
      former: true,
    });
  });

  it("marks active members as not former", () => {
    const rows = groupPeopleRows({
      balances: [{ personId: "owner", netMinor: 0 }],
      removedPersonIds: [],
    });
    expect(rows[0]?.former).toBe(false);
  });
});

describe("member removal mode", () => {
  it("B. deactivates a person with an account but no splits", () => {
    expect(removalMode({ hasGroupHistory: false, linkedToAccount: true })).toBe("deactivate");
  });

  it("deactivates anyone with group history", () => {
    expect(removalMode({ hasGroupHistory: true, linkedToAccount: false })).toBe("deactivate");
  });

  it("deletes an unused placeholder", () => {
    expect(removalMode({ hasGroupHistory: false, linkedToAccount: false })).toBe("delete");
  });
});

describe("member removal mode", () => {
  it("keeps the membership when the client does not know the person", () => {
    expect(removalMode({ hasGroupHistory: false, linkedToAccount: "unknown" })).toBe("deactivate");
  });
});

/**
 * The real-device sequence: an existing account joins a group, is removed
 * before any expense, and must stay reachable as a former member.
 */
describe("removing an account-linked member with no expenses", () => {
  const groupId = "group-1";
  const ownerPersonId = "person-owner";
  const guestPersonId = "person-jonas";

  const people = [
    { id: ownerPersonId, is_self: true, linked_profile_id: "acct-owner" },
    { id: guestPersonId, is_self: false, linked_profile_id: "acct-jonas" },
  ];

  /** Membership rows after the recipient accepted his invitation. */
  const joined: MembershipRow[] = [
    { group_id: groupId, person_id: ownerPersonId, removed_at: null },
    { group_id: groupId, person_id: guestPersonId, removed_at: null },
  ];

  /** What the database holds after removal, per the chosen removal mode. */
  function applyRemoval(members: MembershipRow[], personId: string) {
    const person = people.find((p) => p.id === personId)!;
    const mode = removalMode({
      hasGroupHistory: false, // no expenses, no settlements
      linkedToAccount: Boolean(person.linked_profile_id),
    });
    if (mode === "delete") return members.filter((m) => m.person_id !== personId);
    return members.map((m) =>
      m.person_id === personId && m.group_id === groupId
        ? { ...m, removed_at: "2026-09-24T17:51:00.000Z" }
        : m,
    );
  }

  it("leaves him in the owner's refreshed data as a former member who can be invited again", () => {
    expect(activePersonIdsFor(joined, groupId)).toContain(guestPersonId);

    const afterRemoval = applyRemoval(joined, guestPersonId);

    // Membership preserved, just inactive — same person id, no duplicate row.
    expect(afterRemoval).toHaveLength(2);
    expect(activePersonIdsFor(afterRemoval, groupId)).toEqual([ownerPersonId]);
    expect(removedPersonIdsFor(afterRemoval, groupId)).toEqual([guestPersonId]);

    // The People tab is built from the refreshed data: he is listed once, at
    // zero, labelled as a former member.
    const rows = groupPeopleRows({
      balances: [{ personId: ownerPersonId, netMinor: 0 }],
      removedPersonIds: removedPersonIdsFor(afterRemoval, groupId),
    });
    const row = rows.filter((r) => r.personId === guestPersonId);
    expect(row).toEqual([{ personId: guestPersonId, netMinor: 0, former: true }]);

    // And opening him offers "Invite again".
    expect(
      personInviteAction({ linked: true, pending: false, former: true, isSelf: false }),
    ).toBe("invite-again");
  });

  it("still cleans up an unused placeholder without an account", () => {
    const placeholderId = "person-placeholder";
    const members: MembershipRow[] = [
      { group_id: groupId, person_id: ownerPersonId, removed_at: null },
      { group_id: groupId, person_id: placeholderId, removed_at: null },
    ];
    const mode = removalMode({ hasGroupHistory: false, linkedToAccount: false });
    expect(mode).toBe("delete");
    const after = members.filter((m) => m.person_id !== placeholderId);
    expect(removedPersonIdsFor(after, groupId)).toEqual([]);
  });
});
