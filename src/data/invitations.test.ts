import { describe, expect, it } from "vitest";

import { invitationUrl } from "./invitations";

describe("invitationUrl", () => {
  it("returns the canonical HTTPS Setto invitation URL regardless of window origin", () => {
    // Simulate the Capacitor iOS WebView origin.
    (globalThis as unknown as Record<string, unknown>).window = {
      location: { origin: "capacitor://localhost" },
    };

    expect(invitationUrl("abc123")).toBe("https://setto.dk/invite/abc123");

    // Clean up so later tests cannot accidentally rely on the mock.
    delete (globalThis as unknown as Record<string, unknown>).window;
  });
});
