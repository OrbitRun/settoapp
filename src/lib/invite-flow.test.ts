import { describe, expect, it } from "vitest";

import { joinAction, redeemFallsBackToSignup } from "@/lib/invite-flow";

describe("invitation join action", () => {
  it("waits while the session check is still running", () => {
    expect(joinAction({ authReady: false, userId: null })).toBe("wait");
    expect(joinAction({ authReady: false, userId: "u1" })).toBe("wait");
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
