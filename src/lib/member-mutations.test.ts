// MOCKED client: proves the app's handling of results, NOT database behaviour.
import { describe, expect, it } from "vitest";
import {
  deactivateMembership,
  deleteMembership,
  refreshQuietly,
  type MembershipClient,
} from "./member-mutations";
import { groupPeopleRows, removalMode, removedPersonIdsFor } from "./group-people";

type Row = { id: string; group_id: string; person_id: string; removed_at: string | null };

/** In-memory group_members table; `blocked` emulates RLS hiding the row. */
function fakeClient(rows: Row[], opts: { blocked?: boolean; error?: boolean } = {}) {
  const client = {
    from: () => ({
      update: (values: { removed_at: string }) => ({
        eq: (_c: string, g: string) => ({
          eq: (_c2: string, p: string) => ({
            is: () => ({
              select: async () => {
                if (opts.error) return { data: null, error: { message: "boom" } };
                if (opts.blocked) return { data: [], error: null };
                const hit = rows.filter(
                  (r) => r.group_id === g && r.person_id === p && r.removed_at === null,
                );
                hit.forEach((r) => (r.removed_at = values.removed_at));
                return { data: hit.map((r) => ({ id: r.id })), error: null };
              },
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: (_c: string, g: string) => ({
          eq: (_c2: string, p: string) => ({
            select: async () => {
              if (opts.error) return { data: null, error: { message: "boom" } };
              if (opts.blocked) return { data: [], error: null };
              const hit = rows.filter((r) => r.group_id === g && r.person_id === p);
              hit.forEach((r) => rows.splice(rows.indexOf(r), 1));
              return { data: hit.map((r) => ({ id: r.id })), error: null };
            },
          }),
        }),
      }),
    }),
  };
  return client as unknown as MembershipClient;
}

const base = (): Row[] => [
  { id: "m1", group_id: "g", person_id: "owner", removed_at: null },
  { id: "m2", group_id: "g", person_id: "jonas", removed_at: null },
];

describe("membership removal writes", () => {
  it("successful deactivation marks the row removed", async () => {
    const rows = base();
    expect(await deactivateMembership(fakeClient(rows), "g", "jonas", "t")).toBe("ok");
    expect(rows[1].removed_at).toBe("t");
  });

  it("zero affected rows is a failure, row unchanged", async () => {
    const rows = base();
    expect(await deactivateMembership(fakeClient(rows, { blocked: true }), "g", "jonas", "t")).toBe(
      "no-rows",
    );
    expect(rows[1].removed_at).toBeNull();
  });

  it("database error is a failure", async () => {
    const rows = base();
    expect(await deactivateMembership(fakeClient(rows, { error: true }), "g", "jonas", "t")).toBe(
      "error",
    );
    expect(await deleteMembership(fakeClient(rows, { error: true }), "g", "jonas")).toBe("error");
  });

  it("blocked hard delete of a placeholder is not reported as deleted", async () => {
    const rows = base();
    expect(await deleteMembership(fakeClient(rows, { blocked: true }), "g", "jonas")).toBe(
      "no-rows",
    );
    expect(rows).toHaveLength(2);
  });

  it("account-linked member without expenses stays a recoverable former member", async () => {
    const rows = base();
    const mode = removalMode({ hasGroupHistory: false, linkedToAccount: true });
    expect(mode).toBe("deactivate");
    expect(await deactivateMembership(fakeClient(rows), "g", "jonas", "t")).toBe("ok");
    const people = groupPeopleRows({
      balances: [{ personId: "owner", netMinor: 0 }],
      removedPersonIds: removedPersonIdsFor(rows, "g"),
    });
    expect(people).toContainEqual({ personId: "jonas", netMinor: 0, former: true });
  });

  it("a failed refresh after a confirmed write does not throw", async () => {
    expect(await refreshQuietly(async () => Promise.reject(new Error("offline")))).toBe(false);
  });
});
