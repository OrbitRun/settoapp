import { describe, expect, it } from "vitest";

import {
  buildBrokerUrl,
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
    expect(isCallback("https://open.setto.dk/auth/callback")).toBe(false);
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
