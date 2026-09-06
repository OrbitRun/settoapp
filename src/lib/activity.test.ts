import { describe, expect, it } from "vitest";

import {
  activityHistoryKey,
  activityLabelKey,
  isKnownActivityType,
  normalizeActivityRows,
} from "@/lib/activity";
import { da, en } from "@/lib/i18n";

/** The exact crash mechanism seen on the native Activity page. */
function translate(dict: Record<string, string>, key: string, vars?: Record<string, string>) {
  let text = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value);
    }
  }
  return text;
}

describe("activity type normalization", () => {
  it("treats a type the client does not know as unknown", () => {
    expect(isKnownActivityType("ownership_transferred")).toBe(false);
    expect(isKnownActivityType("expense_added")).toBe(true);
  });

  it("returns a translatable key for unknown types", () => {
    const key = activityLabelKey("ownership_transferred");
    expect(key).toBeTypeOf("string");
    expect(da[key]).toBeTypeOf("string");
    expect(en[key]).toBeTypeOf("string");
    expect(() => translate(da, key, { actor: "Jonas", title: "" })).not.toThrow();
  });

  it("returns a translatable history key for unknown types", () => {
    const key = activityHistoryKey("ownership_transferred");
    expect(da[key]).toBeTypeOf("string");
    expect(en[key]).toBeTypeOf("string");
  });

  it("keeps the raw type and repairs missing metadata", () => {
    const [row] = normalizeActivityRows([
      {
        id: "a1",
        group_id: "g1",
        actor_person_id: null,
        activity_type: "ownership_transferred",
        entity_type: "group",
        entity_id: "g1",
        metadata: null,
        created_at: "2026-09-01T10:00:00Z",
      },
    ]);
    expect(row?.activity_type).toBe("ownership_transferred");
    expect(row?.metadata).toEqual({});
    expect(row?.metadata["title"]).toBeUndefined();
  });

  it("drops rows that are not usable at all", () => {
    expect(normalizeActivityRows([null, 5, { no_id: true }])).toEqual([]);
    expect(normalizeActivityRows(null)).toEqual([]);
  });
});
