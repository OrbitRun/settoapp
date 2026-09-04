import { describe, expect, it } from "vitest";

import { isCallback, SETTO_WEB_ORIGIN } from "./native-auth";

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
