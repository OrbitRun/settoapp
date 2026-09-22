import { describe, expect, it, vi } from "vitest";

import { confirmGroupAfterRedeem, invitationOwnsNavigation } from "@/lib/invite-sync";

const noWait = async () => undefined;

describe("post-redemption group synchronisation", () => {
  it("A. pending invite after signup: navigates only once fresh data holds the group", async () => {
    const order: string[] = [];
    const fetchFresh = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push("stale-fetch");
        return { groups: [{ id: "other" }] };
      })
      .mockImplementationOnce(async () => {
        order.push("fresh-fetch");
        return { groups: [{ id: "other" }, { id: "g1" }] };
      });

    const outcome = await confirmGroupAfterRedeem({
      groupId: "g1",
      fetchFresh,
      wait: noWait,
    });

    expect(outcome).toBe("confirmed");
    order.push("navigate");
    expect(order).toEqual(["stale-fetch", "fresh-fetch", "navigate"]);
  });

  it("B. already signed in: one awaited fresh fetch is enough", async () => {
    const fetchFresh = vi.fn(async () => ({ groups: [{ id: "g1" }] }));
    expect(await confirmGroupAfterRedeem({ groupId: "g1", fetchFresh, wait: noWait })).toBe(
      "confirmed",
    );
    expect(fetchFresh).toHaveBeenCalledTimes(1);
  });

  it("C. synchronisation failure stays bounded and reports unconfirmed", async () => {
    const fetchFresh = vi.fn(async () => ({ groups: [] as { id: string }[] }));
    expect(
      await confirmGroupAfterRedeem({ groupId: "g1", fetchFresh, attempts: 3, wait: noWait }),
    ).toBe("unconfirmed");
    expect(fetchFresh).toHaveBeenCalledTimes(3);
  });

  it("retries through a transient fetch error", async () => {
    const fetchFresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ groups: [{ id: "g1" }] });
    expect(await confirmGroupAfterRedeem({ groupId: "g1", fetchFresh, wait: noWait })).toBe(
      "confirmed",
    );
  });

  it("D. already_member uses the same contract", async () => {
    const fetchFresh = vi.fn(async () => ({ groups: [{ id: "g1" }] }));
    expect(await confirmGroupAfterRedeem({ groupId: "g1", fetchFresh, wait: noWait })).toBe(
      "confirmed",
    );
  });

  it("F. guest migration keeps navigation when the guest carried expenses", () => {
    expect(invitationOwnsNavigation(0)).toBe(true);
    expect(invitationOwnsNavigation(2)).toBe(false);
  });
});
