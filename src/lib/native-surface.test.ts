import { describe, expect, it } from "vitest";

import { SETTO_SURFACE_DARK, SETTO_SURFACE_LIGHT, settoSurfaceColor } from "./native";

describe("settoSurfaceColor", () => {
  it("maps light appearance to the warm off-white Setto surface", () => {
    expect(settoSurfaceColor(false)).toBe("#F7F6F2");
    expect(SETTO_SURFACE_LIGHT).toBe("#F7F6F2");
  });

  it("maps dark appearance to the deep green Setto surface", () => {
    expect(settoSurfaceColor(true)).toBe("#071C19");
    expect(SETTO_SURFACE_DARK).toBe("#071C19");
  });
});
