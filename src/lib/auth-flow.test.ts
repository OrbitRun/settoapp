import { describe, expect, it } from "vitest";

import { shouldRenderAuthedChildren, signupOutcome } from "./auth-flow";

describe("signupOutcome", () => {
  it("continues when signUp returned a session", () => {
    expect(signupOutcome({ access_token: "x" }, null)).toBe("signed-in");
  });

  it("continues when a session is found right after signUp", () => {
    expect(signupOutcome(null, { access_token: "x" })).toBe("signed-in");
  });

  it("never continues without any session", () => {
    expect(signupOutcome(null, null)).toBe("no-session");
    expect(signupOutcome(undefined, undefined)).toBe("no-session");
  });
});

describe("shouldRenderAuthedChildren", () => {
  it("waits while account data is loading", () => {
    expect(shouldRenderAuthedChildren({ authReady: true, isGuest: false, loading: true })).toBe(
      false,
    );
  });

  it("waits while auth is not ready or user is a guest", () => {
    expect(shouldRenderAuthedChildren({ authReady: false, isGuest: false, loading: false })).toBe(
      false,
    );
    expect(shouldRenderAuthedChildren({ authReady: true, isGuest: true, loading: false })).toBe(
      false,
    );
  });

  it("renders once authenticated and loaded", () => {
    expect(shouldRenderAuthedChildren({ authReady: true, isGuest: false, loading: false })).toBe(
      true,
    );
  });
});
