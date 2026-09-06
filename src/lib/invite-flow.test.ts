import { describe, expect, it } from "vitest";

import { joinAction, redeemFallsBackToSignup } from "@/lib/invite-flow";

describe("invitation join action", () => {
  it("waits while the session check is still running", () => {
    expect(joinAction({ authReady: false, userId: null })).toBe("wait");
    expect(joinAction({ authReady: false, userId: "u1" })).toBe("wait");
  });

  it("neither signs up nor redeems while the session check is running", () => {
    for (const userId of [null, "u1"]) {
      const action = joinAction({ authReady: false, userId });
      expect(action).not.toBe("signup");
      expect(action).not.toBe("redeem");
    }
  });

  it("sends a signed-out visitor to signup", () => {
    expect(joinAction({ authReady: true, userId: null })).toBe("signup");
  });

  it("redeems for a signed-in visitor", () => {
    expect(joinAction({ authReady: true, userId: "u1" })).toBe("redeem");
  });

  it("falls back to signup when redeeming without a session", () => {
    expect(redeemFallsBackToSignup("unauthenticated")).toBe(true);
    expect(redeemFallsBackToSignup("joined")).toBe(false);
  });
});
