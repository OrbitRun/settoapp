import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildBrokerUrl,
  evaluateCallback,
  isCallback,
  NATIVE_AUTH_CALLBACK_URL,
  SETTO_APPLINK_ORIGIN,
  SETTO_WEB_ORIGIN,
} from "./native-auth";

describe("native OAuth hand-off origin", () => {
  it("returns to the dedicated hand-off domain, not the auth journey's own domain", () => {
    // iOS never hands a Universal Link to the app while the browser is already
    // on that domain, and the whole broker journey runs on setto.dk.
    expect(NATIVE_AUTH_CALLBACK_URL).toBe(`${SETTO_APPLINK_ORIGIN}/auth/callback`);
    expect(NATIVE_AUTH_CALLBACK_URL.startsWith(SETTO_WEB_ORIGIN)).toBe(false);
  });

  it("sends the broker the native callback as redirect_uri", () => {
    const url = new URL(buildBrokerUrl("google", "abc123"));
    expect(url.searchParams.get("redirect_uri")).toBe(NATIVE_AUTH_CALLBACK_URL);
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("provider")).toBe("google");
  });

  it("recognizes the hand-off callback", () => {
    expect(isCallback(NATIVE_AUTH_CALLBACK_URL)).toBe(true);
    expect(isCallback(`${SETTO_APPLINK_ORIGIN}/auth/callback?code=x`)).toBe(true);
    expect(isCallback(`${SETTO_APPLINK_ORIGIN}/invite/abc`)).toBe(false);
  });
});

describe("isCallback", () => {
  it("accepts the exact Setto web origin + /auth/callback", () => {
    expect(isCallback(`${SETTO_WEB_ORIGIN}/auth/callback`)).toBe(true);
    expect(
      isCallback(`${SETTO_WEB_ORIGIN}/auth/callback#access_token=x&refresh_token=y`),
    ).toBe(true);
    expect(isCallback(`${SETTO_WEB_ORIGIN}/auth/callback?state=abc`)).toBe(true);
  });

  it("rejects other origins with the same path", () => {
    expect(isCallback("https://settoapp.lovable.app/auth/callback")).toBe(false);
    expect(isCallback("https://open.setto.dk.evil.example/auth/callback")).toBe(false);
    expect(isCallback("https://evil.example/auth/callback")).toBe(false);
    expect(isCallback("https://setto.dk.evil.example/auth/callback")).toBe(false);
    expect(isCallback("capacitor://localhost/auth/callback")).toBe(false);
  });

  it("rejects the right origin with the wrong path", () => {
    expect(isCallback(`${SETTO_WEB_ORIGIN}/auth/callback/extra`)).toBe(false);
    expect(isCallback(`${SETTO_WEB_ORIGIN}/reset-password`)).toBe(false);
    expect(isCallback(`${SETTO_WEB_ORIGIN}/`)).toBe(false);
  });

  it("rejects unparseable input", () => {
    expect(isCallback("not a url")).toBe(false);
    expect(isCallback("")).toBe(false);
  });
});

describe("evaluateCallback", () => {
  const cb = (query: string) => `${SETTO_APPLINK_ORIGIN}/auth/callback${query}`;

  it("accepts a valid Google token callback with matching state", () => {
    expect(
      evaluateCallback(cb("?state=s1#access_token=at&refresh_token=rt"), "s1"),
    ).toEqual({ kind: "tokens", accessToken: "at", refreshToken: "rt" });
  });

  it("fails on state mismatch", () => {
    const result = evaluateCallback(cb("?state=other#access_token=at&refresh_token=rt"), "s1");
    expect(result).toEqual({ kind: "error", message: "state mismatch" });
  });

  it("fails when state is missing but expected", () => {
    expect(evaluateCallback(cb("#access_token=at&refresh_token=rt"), "s1").kind).toBe("error");
  });

  it("routes an Apple PKCE code into the exchange path", () => {
    expect(evaluateCallback(cb("?code=abc"))).toEqual({ kind: "code", code: "abc" });
  });

  it("surfaces a provider error", () => {
    expect(evaluateCallback(cb("?error=access_denied"))).toEqual({
      kind: "error",
      message: "access_denied",
    });
  });

  it("rejects a callback from the wrong origin or path", () => {
    expect(evaluateCallback("https://evil.example/auth/callback?code=abc").kind).toBe("error");
    expect(evaluateCallback(`${SETTO_APPLINK_ORIGIN}/other?code=abc`).kind).toBe("error");
  });

  it("fails when no credential is present", () => {
    expect(evaluateCallback(cb(""))).toEqual({ kind: "error", message: "no tokens received" });
  });
});

describe("native OAuth transport", () => {
  const source = readFileSync(new URL("./native-auth.ts", import.meta.url), "utf8");
  const deepLinks = readFileSync(new URL("./deep-links.ts", import.meta.url), "utf8");

  it("no longer uses @capacitor/browser or appUrlOpen for the OAuth callback", () => {
    expect(source).not.toContain("@capacitor/browser");
    expect(source).not.toContain("appUrlOpen");
    expect(source).not.toContain("browserFinished");
  });

  it("uses the native authentication session bridge", () => {
    expect(source).toContain("SettoAuthSession.startAuthentication");
  });

  it("keeps exactly one OAuth credential consumer", () => {
    expect(deepLinks).not.toContain("/auth/callback\", ");
    expect(source.match(/exchangeCodeForSession/g)?.length).toBe(1);
  });

  it("never logs raw tokens, codes or callback URLs", () => {
    const logs = source.match(/console\.info\([^)]*\)/g) ?? [];
    for (const line of logs) {
      expect(line).not.toMatch(/callbackUrl|accessToken|refreshToken|decision\.code|authUrl/);
    }
  });
});
