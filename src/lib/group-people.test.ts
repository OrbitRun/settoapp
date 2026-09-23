import { describe, expect, it } from "vitest";

import { groupPeopleRows, removalMode } from "@/lib/group-people";

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
    expect(rows[0].former).toBe(false);
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
