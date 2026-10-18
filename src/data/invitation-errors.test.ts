import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ lookup: vi.fn(), insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        gt: () => query,
        order: () => query,
        abortSignal: () => query,
        limit: db.lookup,
        insert: () => ({ select: () => ({ single: db.insert }) }),
      };
      return query;
    },
  },
}));

import { ensureGroupInvitation } from "./invitations";

describe("invitation creation error boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.lookup.mockResolvedValue({ data: [], error: null });
  });

  it("propagates a confirmed permission denial instead of an ambiguous null", async () => {
    db.insert.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(ensureGroupInvitation("group", "member")).rejects.toMatchObject({
      kind: "permission",
    });
  });

  it("does not classify an owner's server failure as a permission denial", async () => {
    db.insert.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await expect(ensureGroupInvitation("group", "owner")).rejects.toMatchObject({
      kind: "temporary",
    });
  });

  it("stops on lookup network failure instead of attempting to mint another invitation", async () => {
    db.lookup.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    await expect(ensureGroupInvitation("group", "owner")).rejects.toMatchObject({
      kind: "temporary",
    });
    expect(db.insert).not.toHaveBeenCalled();
  });
});