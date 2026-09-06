import { describe, expect, it } from "vitest";

import { invitationUrl } from "./invitations";

describe("invitationUrl", () => {
  it("returns the canonical HTTPS Setto invitation URL regardless of window origin", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "capacitor://localhost" },
      writable: true,
      configurable: true,
    });

    expect(invitationUrl("abc123")).toBe("https://setto.dk/invite/abc123");
  });
});
