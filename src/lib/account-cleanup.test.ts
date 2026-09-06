import { describe, expect, it } from "vitest";

import { settoLocalKeys, clearSettoLocalState } from "@/lib/account-cleanup";

function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    snapshot: () => [...map.keys()],
  };
}

describe("local Setto state after account deletion", () => {
  const storage = () =>
    fakeStorage({
      "sb-kbv-auth-token": "session",
      "pari.guest.v1": "guest workspace",
      "pari.pendingInvite": "abc123",
      "setto.hideAmounts": "true",
      "setto.draft": "{}",
      "unrelated-app-key": "keep me",
      theme: "dark",
    });

  it("selects every Setto-owned key and nothing else", () => {
    const keys = settoLocalKeys(storage() as unknown as Storage);
    expect(new Set(keys)).toEqual(
      new Set([
        "sb-kbv-auth-token",
        "pari.guest.v1",
        "pari.pendingInvite",
        "setto.hideAmounts",
        "setto.draft",
      ]),
    );
  });

  it("clears them and leaves unrelated browser data untouched", () => {
    const store = storage();
    clearSettoLocalState(store as unknown as Storage);
    expect(store.snapshot().sort()).toEqual(["theme", "unrelated-app-key"]);
  });
});
